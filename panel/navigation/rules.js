function canSwitchTab(setupRequired, target) {
  return setupRequired !== true || target === 'setup';
}

function getLayout(columns, rows) {
  const compact = columns < 80;
  const narrow = columns < 60 || rows < 20;
  const sidebarWidth = compact ? 0 : 20;
  const footerHeight = narrow ? 1 : 2;
  const headerHeight = 1;
  const viewHeight = Math.max(4, rows - footerHeight - headerHeight);
  const contentWidth = columns - sidebarWidth - 2;
  return {
    compact,
    narrow,
    sidebarWidth,
    footerHeight,
    headerHeight,
    viewHeight,
    logHeight: Math.max(3, viewHeight - 5),
    logWidth: Math.max(10, contentWidth - 2),
  };
}

function requiresConfirmation(action) {
  return action === 'stop' || action === 'restart';
}

function canUseTabShortcut(inputVal, view) {
  return !inputVal && view !== 'cfg_edit' && view !== 'cfg_list' && view !== 'data';
}

export { canSwitchTab, getLayout, requiresConfirmation, canUseTabShortcut };
