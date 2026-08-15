const test = require('node:test');
const assert = require('node:assert');
const app = require('../index.js');

test('GET /health returns 200 { status: "ok" }', async () => {
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const res = await fetch(`http://localhost:${port}/health`);
    const body = await res.json();

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(body, { status: 'ok' });
  } finally {
    server.close();
  }
});
