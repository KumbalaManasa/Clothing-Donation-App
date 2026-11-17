// Reverse-geocoding — LLD §1.2 pickup_address_label. No provider was chosen for
// this in HLD §3/§9 (unlike Cloudinary/Firebase/Postgres, which were), and
// calling a live public geocoding API on every listing-create request (and every
// CI test run) would add network flakiness plus rate-limit/ToS risk for no real
// benefit at this stage. This matches coordinates against a small bundled set of
// reference areas by nearest distance, falling back to a plain coordinate label
// when nothing is close enough — deterministic and offline, swappable for a real
// geocoding API later without changing callers.

const REFERENCE_AREAS = [
  { name: 'Koramangala', lat: 12.9352, lng: 77.6245 },
  { name: 'Indiranagar', lat: 12.9784, lng: 77.6408 },
  { name: 'MG Road', lat: 12.9757, lng: 77.6011 },
  { name: 'Whitefield', lat: 12.9698, lng: 77.75 },
  { name: 'Jayanagar', lat: 12.925, lng: 77.5938 },
];

// ~5km of latitude/longitude degrees at this latitude — generous enough for
// MVP-level area matching without being so wide it's meaningless.
const MAX_MATCH_DISTANCE_DEGREES = 0.05;

function distance(lat1, lng1, lat2, lng2) {
  return Math.sqrt((lat1 - lat2) ** 2 + (lng1 - lng2) ** 2);
}

function reverseGeocode(lat, lng) {
  let closest = null;
  let closestDistance = Infinity;

  for (const area of REFERENCE_AREAS) {
    const d = distance(lat, lng, area.lat, area.lng);
    if (d < closestDistance) {
      closestDistance = d;
      closest = area;
    }
  }

  if (closest && closestDistance <= MAX_MATCH_DISTANCE_DEGREES) {
    return closest.name;
  }

  return `Near ${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`;
}

module.exports = { reverseGeocode };
