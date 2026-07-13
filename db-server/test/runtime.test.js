const assert = require('node:assert/strict');
const test = require('node:test');
const { parseNodeVersion } = require('../lib/runtime');
const { assertIdentifier, quoteIdentifier } = require('../lib/identifiers');

test('parses Node versions', () => {
  assert.deepEqual(parseNodeVersion('22.5.1'), { major: 22, minor: 5, patch: 1 });
});

test('accepts only safe SQL identifiers', () => {
  assert.equal(quoteIdentifier('sfmc_players'), '"sfmc_players"');
  assert.throws(() => assertIdentifier('users; DROP TABLE x'), /Invalid SQL/);
});
