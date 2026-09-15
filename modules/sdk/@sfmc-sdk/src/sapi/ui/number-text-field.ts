export type NumberFieldLimits = {
  min?: number;
  max?: number;
  step?: number;
};

export type NumberObservableLike = {
  getData(): number;
  setData(value: number): void;
  subscribe(callback: (value: number) => void): unknown;
};

export type StringObservableLike = {
  getData(): string;
  setData(value: string): void;
  subscribe(callback: (value: string) => void): unknown;
};

export function formatNumberFieldText(value: number): string {
  return Number.isFinite(value) ? String(value) : "";
}

export function parseNumberFieldText(
  raw: string,
  limits: NumberFieldLimits = {},
): number | undefined {
  const trimmed = String(raw).trim();
  if (!trimmed || trimmed === "-" || trimmed === "." || trimmed === "-.") {
    return undefined;
  }
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return undefined;
  const step = limits.step;
  let value = parsed;
  if (typeof step === "number" && step > 0) {
    if (step === 1 && !Number.isInteger(parsed)) {
      if (trimmed.endsWith(".")) return undefined;
      value = Math.round(parsed);
    } else {
      value = Math.round(parsed / step) * step;
    }
  }
  if (typeof limits.min === "number") value = Math.max(limits.min, value);
  if (typeof limits.max === "number") value = Math.min(limits.max, value);
  return value;
}

export function bindNumberTextField(
  numberValue: NumberObservableLike,
  textValue: StringObservableLike,
  limits: NumberFieldLimits = {},
): void {
  let syncing = false;
  numberValue.subscribe(() => {
    if (syncing) return;
    const formatted = formatNumberFieldText(numberValue.getData());
    if (textValue.getData() === formatted) return;
    syncing = true;
    textValue.setData(formatted);
    syncing = false;
  });
  textValue.subscribe(() => {
    if (syncing) return;
    const parsed = parseNumberFieldText(textValue.getData(), limits);
    if (parsed === undefined || parsed === numberValue.getData()) return;
    syncing = true;
    numberValue.setData(parsed);
    syncing = false;
  });
}
