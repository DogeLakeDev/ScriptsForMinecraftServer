function updateProperties(text, data, schema) {
  const fields = new Set(schema.fields.map((field) => field.key));
  const seen = new Set();
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const hasTrailingEol = text.endsWith('\n');
  const lines = text.split(/\r?\n/).map((line) => {
    const match = line.match(/^(\s*)(#?)(\s*)([^=\s]+)(\s*)=(.*)$/);
    if (!match || match[2] === '#' || !fields.has(match[4])) return line;
    seen.add(match[4]);
    const value = data[match[4]];
    return `${match[1]}${match[4]}${match[5]}=${typeof value === 'boolean' ? String(value) : String(value ?? '')}`;
  });
  if (hasTrailingEol && lines.at(-1) === '') lines.pop();
  for (const field of schema.fields) {
    if (!seen.has(field.key) && data[field.key] !== undefined) lines.push(`${field.key}=${data[field.key]}`);
  }
  return lines.join(eol) + (hasTrailingEol ? eol : '');
}

export { updateProperties };
