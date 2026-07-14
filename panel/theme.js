const T = {
  bg: '#0d0f12',
  panel: '#171b22',
  surface: '#171b22',
  surfaceAlt: '#1d2230',
  surfaceFocus: '#273244',
  element: '#273244',
  text: '#d9e1ec',
  muted: '#8d9aae',
  subtle: '#5a6577',
  inverse: '#0d0f12',
  primary: '#8ec5ff',
  secondary: '#b8a5ff',
  accent: '#7aa2f7',
  error: '#e06c75',
  warning: '#f5a742',
  success: '#7fd88f',
  info: '#79c0ff',
  border: '#3b4658',
  borderFocus: '#8ec5ff',
  borderSoft: '#283342',
  focusBg: '#273244',
  separator: '#283342',
  // 语义 token
  serviceRunning: '#7fd88f',
  serviceStopped: '#e06c75',
  serviceStale: '#f5a742',
  roleOwner: '#f5a742',
  roleAdmin: '#b8a5ff',
  roleMember: '#8d9aae',
};

const LEVEL_PREFIX = {
  info: '[*]', error: '[x]', warning: '[!]', success: '[+]', debug: '[?]',
};

const LEVEL_COLOR = {
  info: T.info,
  error: T.error,
  warning: T.warning,
  success: T.success,
  debug: T.muted,
};

export { T, LEVEL_PREFIX, LEVEL_COLOR };