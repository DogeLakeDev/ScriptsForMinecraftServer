function createGlobalInputHandler({
  input,
  key,
  confirm,
  helpOpen,
  editing,
  inputVal,
  isSetupActive,
  setupRequired,
  activeTab,
  tabs,
  quitPending,
  callbacks,
}) {
  const isCtrlC = key.ctrl && input === 'c';
  const isQuit = input === 'q' && !inputVal;

  if (confirm) {
    if (input === 'y') callbacks.confirm(confirm, true);
    else if (input === 'n' || key.escape) callbacks.confirm(confirm, false);
    return true;
  }

  if (isSetupActive) {
    if (isQuit) {
      callbacks.quit(quitPending);
      return true;
    }
    if (quitPending) callbacks.clearQuitPending();
    if (isCtrlC) {
      callbacks.forceQuit();
      return true;
    }
    if (setupRequired !== true && !inputVal && input && '123456789'.includes(input)) {
      const tab = tabs[parseInt(input, 10) - 1];
      if (tab) callbacks.switchTab(tab.k);
      return !!tab;
    }
    if (setupRequired !== true && key.tab) {
      const index = tabs.findIndex((tab) => tab.k === activeTab);
      callbacks.switchTab(tabs[(index + 1) % tabs.length].k);
      return true;
    }
    return true;
  }

  if (callbacks.mouseActive()) return true;

  if ((input === '?' || input === 'h' || input === 'F1') && editing === null && !inputVal) {
    if (!helpOpen) {
      callbacks.setHelpOpen(true);
      return true;
    }
  }
  if (helpOpen && (key.escape || input === '?' || input === 'h')) {
    callbacks.setHelpOpen(false);
    return true;
  }
  if (helpOpen) return true;

  if (isQuit) {
    callbacks.quit(quitPending);
    return true;
  }
  if (quitPending) callbacks.clearQuitPending();
  if (isCtrlC) {
    callbacks.forceQuit();
    return true;
  }
  return false;
}

export { createGlobalInputHandler };
