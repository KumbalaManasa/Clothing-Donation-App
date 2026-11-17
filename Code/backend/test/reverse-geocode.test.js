const test = require('node:test');
const assert = require('node:assert');
const { reverseGeocode } = require('../src/services/reverseGeocode');

test('reverseGeocode returns the matching area name for known coordinates', () => {
  assert.strictEqual(reverseGeocode(12.9352, 77.6245), 'Koramangala');
  assert.strictEqual(reverseGeocode(12.9784, 77.6408), 'Indiranagar');
});

test('reverseGeocode falls back to a coordinate label when nothing is nearby', () => {
  const label = reverseGeocode(0, 0);
  assert.match(label, /^Near /);
});
