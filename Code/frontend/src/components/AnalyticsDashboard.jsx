import { useEffect, useState } from 'react'
import { BarChart3, Check, Clock3, Shirt, Users } from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { apiFetch } from '../api/client.js'

const CONDITION_COLORS = ['#26855f', '#4da997', '#d6a23e', '#de7845', '#9aa49d']
const ICONS = { clothes: Shirt, check: Check, clock: Clock3, people: Users, chart: BarChart3 }

function MetricIcon({ type }) {
  const Icon = ICONS[type] || BarChart3
  return <Icon className="metric-icon" aria-hidden="true" strokeWidth={1.8} />
}

const roleCards = {
  donor: [
    ['totalDonations', 'Total donations', 'clothes'],
    ['claimed', 'Claimed by NGOs', 'check'],
    ['declined', 'Released by NGOs', 'clock'],
    ['totalClothes', 'Clothes donated', 'clothes'],
  ],
  ngo: [
    ['totalClaimed', 'Donations claimed', 'clothes'],
    ['delivered', 'Delivered', 'check'],
    ['failed', 'Delivery failed', 'clock'],
    ['pending', 'Not yet delivered', 'chart'],
    ['successRate', 'Success rate', 'check', '%'],
  ],
  admin: [
    ['totalDonations', 'Total donations', 'clothes'],
    ['totalClothes', 'Total clothes', 'clothes'],
    ['delivered', 'Delivered', 'check'],
    ['declined', 'Declined', 'clock'],
    ['pending', 'Pending', 'chart'],
    ['failed', 'Failed', 'clock'],
  ],
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value) || 0)
}

function SummaryCards({ role, summary }) {
  return <div className={`analytics-metrics metrics-${role}`}>
    {roleCards[role].map(([key, title, icon, suffix]) => (
      <article className="analytics-metric" key={key}>
        <span className="metric-icon-wrap"><MetricIcon type={icon} /></span>
        <span className="metric-label">{title}</span>
        <strong>{formatNumber(summary?.[key])}{suffix || ''}</strong>
      </article>
    ))}
  </div>
}

function PeakBadge({ peak }) {
  return peak ? <span className="peak-badge">Peak: {peak.month} ({formatNumber(peak.count)})</span> : null
}

function Panel({ title, subtitle, peak, children, className = '' }) {
  return <section className={`analytics-panel ${className}`}>
    <div className="analytics-panel-heading">
      <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
      <PeakBadge peak={peak} />
    </div>
    {children}
  </section>
}

function MonthlyChart({ data, role, peak }) {
  const key = role === 'donor' ? 'clothes' : 'deliveries'
  const title = role === 'donor' ? 'Clothes donated by month' : 'Deliveries by month'
  return <Panel title={title} subtitle="Last 12 months" peak={peak}>
    {data?.length ? <div className="chart-frame">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="#e8ece7" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#66736b', fontSize: 11 }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#66736b', fontSize: 11 }} />
          <Tooltip cursor={{ fill: '#f2f6f2' }} />
          <Bar dataKey={key} name={role === 'donor' ? 'Clothes' : 'Deliveries'} fill="#287654" radius={[5, 5, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div> : <p className="analytics-empty">No donations yet.</p>}
  </Panel>
}

function ConditionChart({ data }) {
  const values = (data || []).filter((entry) => entry.value > 0)
  return <Panel title="Condition breakdown" subtitle="Based on clothing item records">
    {values.length ? <div className="condition-chart-wrap">
      <div className="condition-chart">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart><Pie data={values} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="86%" paddingAngle={3} stroke="none">
            {values.map((item, index) => <Cell key={item.name} fill={CONDITION_COLORS[index % CONDITION_COLORS.length]} />)}
          </Pie><Tooltip /></PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="condition-legend">{values.map((item, index) => <li key={item.name}><span style={{ background: CONDITION_COLORS[index % CONDITION_COLORS.length] }} />{item.name}<strong>{formatNumber(item.value)}</strong></li>)}</ul>
    </div> : <p className="analytics-empty">No donations yet.</p>}
  </Panel>
}

function RankingTable({ title, rows, countKey, countLabel }) {
  return <Panel title={title}>
    {rows?.length ? <div className="analytics-table-scroll"><table className="analytics-table"><thead><tr><th>Name</th><th>{countLabel}</th></tr></thead><tbody>
      {rows.map((row, index) => <tr key={`${row.name}-${index}`}><td><span className="rank-number">{index + 1}</span>{row.name || 'Unnamed organization'}</td><td>{formatNumber(row[countKey])}</td></tr>)}
    </tbody></table></div> : <p className="analytics-empty">No donations yet.</p>}
  </Panel>
}

function AdminCharts({ data }) {
  return <Panel title="Donated vs delivered" subtitle="Monthly platform trend" peak={data.peakMonth} className="analytics-panel-wide">
    {data.monthly?.length ? <div className="chart-frame">
      <ResponsiveContainer width="100%" height="100%"><LineChart data={data.monthly} margin={{ top: 8, right: 18, bottom: 0, left: -16 }}>
        <CartesianGrid stroke="#e8ece7" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#66736b', fontSize: 11 }} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#66736b', fontSize: 11 }} />
        <Tooltip /><Legend />
        <Line type="monotone" dataKey="donated" name="Donated" stroke="#287654" strokeWidth={2.5} dot={false} />
        <Line type="monotone" dataKey="delivered" name="Delivered" stroke="#d39a2e" strokeWidth={2.5} dot={false} />
      </LineChart></ResponsiveContainer>
    </div> : <p className="analytics-empty">No donations yet.</p>}
  </Panel>
}

function NgoRates({ rows }) {
  return <Panel title="Delivery success by NGO" className="analytics-panel-wide">
    {rows?.length ? <div className="analytics-table-scroll"><table className="analytics-table"><thead><tr><th>NGO</th><th>Claimed</th><th>Delivered</th><th>Failed</th><th>Rate</th></tr></thead><tbody>
      {rows.map((row) => <tr key={row.name}><td>{row.name}</td><td>{formatNumber(row.claimed)}</td><td>{formatNumber(row.delivered)}</td><td>{formatNumber(row.failed)}</td><td>{row.rate}%</td></tr>)}
    </tbody></table></div> : <p className="analytics-empty">No donations yet.</p>}
  </Panel>
}

function Skeleton() {
  return <div className="analytics-loading" aria-label="Loading dashboard" aria-busy="true"><div className="analytics-skeleton-row">{[1, 2, 3, 4].map((n) => <span key={n} />)}</div><div className="analytics-skeleton-panel" /><div className="analytics-skeleton-panel" /></div>
}

function AnalyticsDashboard({ role }) {
  const [range, setRange] = useState('this_month')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    const query = role === 'admin' ? `?range=${range}` : ''
    apiFetch(`/api/dashboard/${role}${query}`)
      .then((result) => { if (!cancelled) setData(result) })
      .catch((err) => { if (!cancelled) setError(err.message || 'Unable to load dashboard') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [role, range])

  return <section className="analytics-dashboard" aria-label={`${role} analytics dashboard`}>
    <header className="analytics-header">
      <div><p className="analytics-eyebrow">IMPACT OVERVIEW</p><h2>Analytics</h2><p className="analytics-description">A clear view of your clothing donation journey.</p></div>
      {role === 'admin' && <label className="range-filter">Date range<select value={range} onChange={(event) => setRange(event.target.value)}>
        <option value="this_month">This month</option><option value="last_3_months">Last 3 months</option><option value="this_year">This year</option><option value="all_time">All time</option>
      </select></label>}
    </header>
    {loading && <Skeleton />}
    {!loading && error && <div className="analytics-error" role="alert">{error}</div>}
    {!loading && !error && data && <>
      <SummaryCards role={role} summary={data.summary} />
      {((role === 'donor' && !data.summary.totalDonations) || (role === 'ngo' && !data.summary.totalClaimed) || (role === 'admin' && !data.summary.totalDonations)) && <p className="analytics-empty-notice">No donations yet.</p>}
      {role === 'donor' && <div className="analytics-grid"><MonthlyChart data={data.monthly} role={role} peak={data.peakMonth} /><ConditionChart data={data.condition} /></div>}
      {role === 'ngo' && <div className="analytics-grid"><MonthlyChart data={data.monthly} role={role} peak={data.peakMonth} /><ConditionChart data={data.condition} /></div>}
      {role === 'admin' && <>
        <div className="analytics-grid"><AdminCharts data={data} /><ConditionChart data={data.condition} /></div>
        <div className="analytics-grid admin-rankings"><RankingTable title="Top NGOs · donations claimed" rows={data.topNgosByClaimed} countKey="donations" countLabel="Claimed" /><RankingTable title="Top NGOs · successful deliveries" rows={data.topNgosByDelivered} countKey="deliveries" countLabel="Delivered" /><RankingTable title="Top donors" rows={data.topDonors} countKey="donations" countLabel="Donations" /></div>
        <NgoRates rows={data.ngoDeliveryRates} />
      </>}
    </>}
  </section>
}

export default AnalyticsDashboard
