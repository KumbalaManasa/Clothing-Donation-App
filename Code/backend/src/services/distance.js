// Haversine great-circle distance in kilometers — used by GET /listings/open's
// proximity filter/sort (LLD §3.3). Exact "nearby" radius/sort tuning is an
// open item (spec.md §10 / LLD §7.3); this ships the straightforward, correct
// distance formula with a sane default radius for now.
const EARTH_RADIUS_KM = 6371;

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

module.exports = { haversineDistanceKm };
