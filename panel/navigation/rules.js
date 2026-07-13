function canSwitchTab(setupRequired, target) {
  return setupRequired !== true || target === 'setup';
}

function getLayout(columns, rows) {
  const compact = columns < 80;
  const narrow = columns < 60 || rows < 18;
  const footerHeight = narrow ? 2 : 4;
  const viewHeight = Math.max(4, rows - footerHeight - 1);
  return {
    compact,
    narrow,
    footerHeight,
    viewHeight,
    logHeight: Math.max(1, viewHeight - 6),
    logWidth: Math.max(10, columns - (compact ? 4 : 24)),
  };
}

function requiresConfirmation(action) {
  return action === 'stop' || action === 'restart';
}

function canUseTabShortcut(inputVal, view) {
  return !inputVal && view !== 'cfg_edit' && view !== 'cfg_list' && view !== 'data';
}

export { canSwitchTab, getLayout, requiresConfirmation, canUseTabShortcut };
