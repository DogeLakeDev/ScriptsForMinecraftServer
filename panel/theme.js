const T = {
  bg: '#000000',
  panel: '#141414',
  element: '#8076a3',
  text: '#d4d4d4',
  muted: '#d4d4d4',
  primary: '#d4d4d4',
  secondary: '#d4d4d4',
  accent: '#8076a3',
  error: '#e06c75',
  warning: '#f5a742',
  success: '#7fd88f',
  info: '#d4d4d4',
  border: '#484848',
  borderFocus: '#606060',
  borderSoft: '#3c3c3c',
  focusBg: '#8076a3',
  separator: '#3c3c3c',
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

