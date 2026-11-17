const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const router = express.Router();
const CONDITIONS = ['Great', 'Good', 'Average', 'A bit bad'];

function monthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getStartDate(range) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  if (range === 'this_month') return start;
  if (range === 'last_3_months') {
    start.setUTCMonth(start.getUTCMonth() - 2);
    return start;
  }
  if (range === 'this_year') return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  if (range === 'all_time') return null;
  return undefined;
}

function makeMonths(start, end = new Date()) {
  const first = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  const months = [];
  while (first <= last) {
    const key = monthKey(first);
    months.push({ key, label: first.toLocaleDateString('en', { month: 'short', year: 'numeric', timeZone: 'UTC' }) });
    first.setUTCMonth(first.getUTCMonth() + 1);
  }
  return months;
}

function fillMonths(months, rows, property) {
  const values = new Map(rows.map((row) => [row.month_key, Number(row.value) || 0]));
  return months.map((month) => ({ ...month, [property]: values.get(month.key) || 0 }));
}

function peakOf(rows, property) {
  if (!rows.length) return null;
  const highest = rows.reduce((best, row) => row[property] > best[property] ? row : best, rows[0]);
  return highest[property] > 0 ? { month: highest.label, count: highest[property] } : null;
}

function normalizeConditionRows(rows) {
  const totals = Object.fromEntries(CONDITIONS.map((condition) => [condition, 0]));
  let other = 0;
  for (const row of rows) {
    const label = String(row.condition || '').trim().toLowerCase();
    const canonical = CONDITIONS.find((condition) => condition.toLowerCase() === label);
    if (canonical) totals[canonical] += Number(row.count) || 0;
    else other += Number(row.count) || 0;
  }
  return [...CONDITIONS.map((name) => ({ name, value: totals[name] })), ...(other ? [{ name: 'Other', value: other }] : [])];
}

function applySince(query, column, start) {
  return start ? query.where(column, '>=', start) : query;
}

async function conditionCountsForDonor(donorId) {
  const rows = await db('listing_items as i')
    .join('listings as l', 'l.id', 'i.listing_id')
    .where('l.donor_id', donorId)
    .select('i.condition')
    .count('i.id as count')
    .groupBy('i.condition');
  return normalizeConditionRows(rows);
}

router.get('/donor', requireAuth, requireRole('donor'), async (req, res) => {
  const donorId = req.user.uid;
  const [donations, outcomes, condition, monthlyRows] = await Promise.all([
    db('listings').where({ donor_id: donorId }).countDistinct('id as count').first(),
    db('claims as c').join('listings as l', 'l.id', 'c.listing_id').where('l.donor_id', donorId)
      .select(db.raw("count(distinct l.id) FILTER (WHERE c.status <> 'declined') as claimed"))
      .select(db.raw("count(distinct l.id) FILTER (WHERE c.status = 'declined') as declined")).first(),
    conditionCountsForDonor(donorId),
    db('listings as l').join('listing_items as i', 'i.listing_id', 'l.id')
      .where('l.donor_id', donorId).where('l.created_at', '>=', db.raw("date_trunc('month', now()) - interval '11 months'"))
      .select(db.raw("to_char(date_trunc('month', l.created_at), 'YYYY-MM') as month_key"))
      .count('i.id as value').groupByRaw("date_trunc('month', l.created_at)").orderByRaw("date_trunc('month', l.created_at)"),
  ]);
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCMonth(start.getUTCMonth() - 11);
  const monthly = fillMonths(makeMonths(start), monthlyRows, 'clothes');
  return res.status(200).json({
    summary: {
      totalDonations: Number(donations.count) || 0,
      claimed: Number(outcomes?.claimed) || 0,
      declined: Number(outcomes?.declined) || 0,
      totalClothes: condition.reduce((sum, row) => sum + row.value, 0),
    },
    condition,
    monthly,
    peakMonth: peakOf(monthly, 'clothes'),
  });
});

router.get('/ngo', requireAuth, requireRole('ngo'), async (req, res) => {
  const ngoId = req.user.uid;
  const [claims, deliveries, failures, pendingClaims, conditionRows, monthlyRows] = await Promise.all([
    db('claims as c').leftJoin('distributions as d', 'd.listing_id', 'c.listing_id').where('c.ngo_id', ngoId)
      .whereIn('c.status', ['active', 'fulfilled', 'failed']).orWhere(function includeLegacyDeliveries() {
        this.where('c.ngo_id', ngoId).whereNotNull('d.id');
      }).countDistinct('c.id as count').first(),
    db('distributions').where({ ngo_id: ngoId }).count('* as count').first(),
    db('claims').where({ ngo_id: ngoId, status: 'failed' }).count('* as count').first(),
    db('claims as c').join('listings as l', 'l.id', 'c.listing_id')
      .leftJoin('distributions as d', 'd.listing_id', 'l.id')
      .where({ 'c.ngo_id': ngoId, 'c.status': 'active' })
      .whereNull('d.id').whereIn('l.status', ['claimed', 'picked_up']).countDistinct('c.id as count').first(),
    db('listing_items as i').join('listings as l', 'l.id', 'i.listing_id')
      .join('claims as c', 'c.listing_id', 'l.id').where('c.ngo_id', ngoId)
      .whereIn('c.status', ['active', 'fulfilled', 'failed'])
      .select('i.condition').countDistinct('i.id as count').groupBy('i.condition'),
    db('distributions as d').where('d.ngo_id', ngoId)
      .where('d.distributed_at', '>=', db.raw("date_trunc('month', now()) - interval '11 months'"))
      .select(db.raw("to_char(date_trunc('month', d.distributed_at), 'YYYY-MM') as month_key"))
      .count('d.id as value').groupByRaw("date_trunc('month', d.distributed_at)").orderByRaw("date_trunc('month', d.distributed_at)"),
  ]);
  const deliveredCount = Number(deliveries.count) || 0;
  const claimCount = Number(claims.count) || 0;
  const failureCount = Number(failures.count) || 0;
  const pendingCount = Number(pendingClaims.count) || 0;
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCMonth(start.getUTCMonth() - 11);
  const monthly = fillMonths(makeMonths(start), monthlyRows, 'deliveries');
  return res.status(200).json({
    summary: {
      totalClaimed: claimCount,
      delivered: deliveredCount,
      failed: failureCount,
      pending: pendingCount,
      successRate: claimCount ? Math.round((deliveredCount / claimCount) * 1000) / 10 : 0,
    },
    condition: normalizeConditionRows(conditionRows),
    monthly,
    peakMonth: peakOf(monthly, 'deliveries'),
  });
});

router.get('/admin', requireAuth, requireRole('admin'), async (req, res) => {
  const range = req.query.range || 'this_month';
  const start = getStartDate(range);
  if (start === undefined) return res.status(400).json({ message: 'range must be this_month, last_3_months, this_year, or all_time' });

  const donationsQuery = applySince(db('listings'), 'created_at', start);
  const clothesQuery = applySince(db('listing_items as i').join('listings as l', 'l.id', 'i.listing_id'), 'l.created_at', start);
  const deliveryQuery = applySince(db('distributions'), 'distributed_at', start);
  const declineQuery = applySince(db('claims'), 'declined_at', start);
  const pendingQuery = applySince(db('listings').whereIn('status', ['listed', 'claimed', 'picked_up']), 'created_at', start);

  const [donations, clothes, deliveries, declines, pending, conditionRows, donatedMonths, deliveredMonths, topDonors, topClaimedNgos, topDeliveredNgos, ngoRows, earliest] = await Promise.all([
    donationsQuery.count('* as count').first(),
    clothesQuery.count('i.id as count').first(),
    deliveryQuery.count('* as count').first(),
    declineQuery.count('* as count').first(),
    pendingQuery.count('* as count').first(),
    applySince(db('listing_items as i').join('listings as l', 'l.id', 'i.listing_id'), 'l.created_at', start)
      .select('i.condition').count('i.id as count').groupBy('i.condition'),
    applySince(db('listings'), 'created_at', start)
      .select(db.raw("to_char(date_trunc('month', created_at), 'YYYY-MM') as month_key"))
      .countDistinct('id as value').groupByRaw("date_trunc('month', created_at)").orderByRaw("date_trunc('month', created_at)"),
    applySince(db('distributions'), 'distributed_at', start)
      .select(db.raw("to_char(date_trunc('month', distributed_at), 'YYYY-MM') as month_key"))
      .count('* as value').groupByRaw("date_trunc('month', distributed_at)").orderByRaw("date_trunc('month', distributed_at)"),
    applySince(db('listings as l').join('users as u', 'u.id', 'l.donor_id').where('u.role', 'donor'), 'l.created_at', start)
      .select('u.id', 'u.name').countDistinct('l.id as donations').groupBy('u.id', 'u.name').orderBy('donations', 'desc').limit(5),
    applySince(db('claims as c').join('users as u', 'u.id', 'c.ngo_id').whereIn('c.status', ['active', 'fulfilled', 'failed']), 'c.claimed_at', start)
      .select('u.id', 'u.org_name').countDistinct('c.listing_id as donations').groupBy('u.id', 'u.org_name').orderBy('donations', 'desc').limit(5),
    applySince(db('distributions as d').join('users as u', 'u.id', 'd.ngo_id'), 'd.distributed_at', start)
      .select('u.id', 'u.org_name').count('d.id as deliveries').groupBy('u.id', 'u.org_name').orderBy('deliveries', 'desc').limit(5),
    applySince(db('claims as c').join('users as u', 'u.id', 'c.ngo_id').where('u.role', 'ngo'), 'c.claimed_at', start)
      .select('u.id', 'u.org_name')
      .count('c.id as claimed')
      .countDistinct({ delivered: 'd.id' })
      .count({ failed: db.raw("CASE WHEN c.status = 'failed' THEN 1 END") })
      .leftJoin('distributions as d', 'd.listing_id', 'c.listing_id')
      .groupBy('u.id', 'u.org_name').orderBy('u.org_name'),
    db('listings').min({ first_created: 'created_at' }).first(),
  ]);

  const deliveredCount = Number(deliveries.count) || 0;
  const claimedForRate = ngoRows.map((row) => ({
    name: row.org_name,
    claimed: Number(row.claimed) || 0,
    delivered: Number(row.delivered) || 0,
    failed: Number(row.failed) || 0,
    rate: Number(row.claimed) ? Math.round((Number(row.delivered) / Number(row.claimed)) * 1000) / 10 : 0,
  }));
  const currentMonth = new Date();
  const monthStart = start || (earliest.first_created ? new Date(earliest.first_created) : new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth(), 1)));
  const months = makeMonths(monthStart, currentMonth);
  const monthlyDonated = fillMonths(months, donatedMonths, 'donated');
  const deliveredMap = new Map(deliveredMonths.map((row) => [row.month_key, Number(row.value) || 0]));
  const monthly = monthlyDonated.map((row) => ({ ...row, delivered: deliveredMap.get(row.key) || 0 }));
  const topNgosByClaimed = topClaimedNgos.map((row) => ({ name: row.org_name, donations: Number(row.donations) || 0 }));
  const topNgosByDelivered = topDeliveredNgos.map((row) => ({ name: row.org_name, deliveries: Number(row.deliveries) || 0 }));

  return res.status(200).json({
    range,
    summary: {
      totalDonations: Number(donations.count) || 0,
      totalClothes: Number(clothes.count) || 0,
      delivered: deliveredCount,
      declined: Number(declines.count) || 0,
      pending: Number(pending.count) || 0,
      failed: Number(ngoRows.reduce((sum, row) => sum + (Number(row.failed) || 0), 0)),
    },
    monthly,
    peakMonth: peakOf(monthly, 'donated'),
    condition: normalizeConditionRows(conditionRows),
    topDonors: topDonors.map((row) => ({ name: row.name, donations: Number(row.donations) || 0 })),
    topNgosByClaimed,
    topNgosByDelivered,
    ngoDeliveryRates: claimedForRate,
  });
});

module.exports = router;
