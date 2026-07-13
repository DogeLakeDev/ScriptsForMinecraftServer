function assertIdentifier(value, label = 'identifier') {
  if (typeof value !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    const error = new Error(`Invalid SQL ${label}`);
    error.code = 'INVALID_IDENTIFIER';
    throw error;
  }
  return value;
}

function quoteIdentifier(value, label) {
  return `"${assertIdentifier(value, label)}"`;
}

module.exports = { assertIdentifier, quoteIdentifier };
