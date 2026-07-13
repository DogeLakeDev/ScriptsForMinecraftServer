const T = {
  bg: '#0d0f12',
  panel: '#171b22',
  element: '#273244',
  text: '#d9e1ec',
  muted: '#8d9aae',
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
