class IdentifierError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    Object.setPrototypeOf(this, IdentifierError.prototype);
  }
}

export function assertIdentifier(value: unknown, label: string = "identifier"): string {
  if (typeof value !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new IdentifierError(`Invalid SQL ${label}`, "INVALID_IDENTIFIER");
  }
  return value;
}

export function quoteIdentifier(value: string, label: string): string {
  return `"${assertIdentifier(value, label)}"`;
}
