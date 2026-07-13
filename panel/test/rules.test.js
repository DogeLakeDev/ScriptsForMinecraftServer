import assert from 'node:assert/strict';
import test from 'node:test';
import { getLayout, canSwitchTab, canUseTabShortcut, requiresConfirmation } from '../navigation/rules.js';
import { appendDigit, removeLastDigit, parseSelection } from '../navigation/input.js';

test('setup lock only permits the setup screen', () => {
  assert.equal(canSwitchTab(true, 'setup'), true);
  assert.equal(canSwitchTab(true, 'dashboard'), false);
  assert.equal(canSwitchTab(false, 'dashboard'), true);
});

test('layout is bounded for a standard terminal', () => {
  assert.deepEqual(getLayout(80, 24), {
    compact: false,
    narrow: false,
    footerHeight: 4,
    viewHeight: 19,
    logHeight: 13,
    logWidth: 56,
  });
});

test('layout remains valid in a tiny terminal', () => {
  const layout = getLayout(40, 10);
  assert.equal(layout.compact, true);
  assert.equal(layout.narrow, true);
  assert.ok(layout.viewHeight >= 4);
  assert.ok(layout.logHeight >= 1);
  assert.ok(layout.logWidth >= 10);
});

test('stopping or restarting a service requires confirmation', () => {
  assert.equal(requiresConfirmation('start'), false);
  assert.equal(requiresConfirmation('stop'), true);
  assert.equal(requiresConfirmation('restart'), true);
});

test('data table number selection does not trigger a tab shortcut', () => {
  assert.equal(canUseTabShortcut('', 'data'), false);
  assert.equal(canUseTabShortcut('', 'dashboard'), true);
  assert.equal(canUseTabShortcut('1', 'dashboard'), false);
});

test('data table selection supports multi-digit input', () => {
  assert.equal(appendDigit(appendDigit('', '1'), '2'), '12');
  assert.equal(removeLastDigit('120'), '12');
  assert.equal(parseSelection('12', 20), 11);
  assert.equal(parseSelection('21', 20), -1);
});
