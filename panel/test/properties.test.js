import assert from 'node:assert/strict';
import test from 'node:test';
import { updateProperties } from '../config/properties.js';

const schema = {
  fields: [
    { key: 'server-port' },
    { key: 'allow-cheats' },
    { key: 'motd' },
  ],
};

test('properties update preserves comments, unknown fields, and CRLF', () => {
  const source = '# Keep this comment\r\nserver-port=19132\r\nnew-bds-field=value\r\nallow-cheats=false\r\n';
  const actual = updateProperties(source, {
    'server-port': 19133,
    'allow-cheats': true,
    motd: 'Test server',
  }, schema);

  assert.equal(actual, '# Keep this comment\r\nserver-port=19133\r\nnew-bds-field=value\r\nallow-cheats=true\r\nmotd=Test server\r\n');
});

test('properties update does not change commented settings', () => {
  const actual = updateProperties('# motd=old\nmotd=current\n', { motd: 'new' }, schema);
  assert.equal(actual, '# motd=old\nmotd=new\n');
});
