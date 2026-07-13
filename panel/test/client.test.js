import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveDbConfig } from '../api/client.js';

test('DB environment variables override state and file configuration', () => {
  assert.deepEqual(resolveDbConfig({
    env: { DB_HOST: '10.0.0.8', DB_PORT: '4100' },
    state: { paths: { dbHost: 'state-host', dbPort: 3200 } },
    config: { db_host: 'config-host', db_port: 3300 },
  }), { host: '10.0.0.8', port: 4100 });
});

test('DB state overrides file configuration and invalid ports fall back', () => {
  assert.deepEqual(resolveDbConfig({
    env: {},
    state: { paths: { dbPort: 3200 } },
    config: { db_host: 'config-host', db_port: 3300 },
  }), { host: 'config-host', port: 3200 });

  assert.deepEqual(resolveDbConfig({ env: { DB_PORT: '70000' } }), { host: '127.0.0.1', port: 3001 });
});
