function appendDigit(value, digit) {
  if (!/^\d$/.test(digit)) return value;
  return `${value}${digit}`.replace(/^0+(?=\d)/, '');
}

function removeLastDigit(value) {
  return String(value || '').slice(0, -1);
}

function parseSelection(value, length) {
  const index = Number.parseInt(value, 10);
  return Number.isInteger(index) && index >= 1 && index <= length ? index - 1 : -1;
}

export { appendDigit, removeLastDigit, parseSelection };
