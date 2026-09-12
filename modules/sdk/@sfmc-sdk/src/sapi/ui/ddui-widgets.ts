/**
 * 把声明式 JSON 字段映射成 CustomForm 能吃的参数。
 *
 * 按钮不能用 § 色码（DDUI 会剥掉），tone 改成剥离后仍可见的前缀标记。
 */

import type { ObservableBoolean } from "@minecraft/server-ui";

export type CustomFormImageArgs = {
  src: string;
  pack: string;
};

export type CustomFormButtonImageDetails = {
  imageSrc: string;
  imagePackId: string;
};

function text(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

/** 图像必须同时有 source 与 pack，否则不渲染（空 pack 在 CustomForm 上等于废图）。 */
export function customFormImageArgs(node: {
  source?: unknown;
  pack?: unknown;
}): CustomFormImageArgs | undefined {
  const src = text(node.source).trim();
  const pack = text(node.pack).trim();
  if (!src || !pack) return undefined;
  return { src, pack };
}

/** 按钮图标对应 ButtonOptions.imageDetails；缺 pack 则不加图标。 */
export function customFormButtonImageDetails(node: {
  icon?: unknown;
  iconPack?: unknown;
}): CustomFormButtonImageDetails | undefined {
  const imageSrc = text(node.icon).trim();
  const imagePackId = text(node.iconPack).trim();
  if (!imageSrc || !imagePackId) return undefined;
  return { imageSrc, imagePackId };
}

function buttonToneMarker(tone: unknown): string {
  switch (tone) {
    case "success":
      return "✔ ";
    case "warning":
      return "！ ";
    case "danger":
      return "✘ ";
    default:
      return "";
  }
}

/** 按钮文案：tone 用可见标记，避免写入会被剥掉的 § 色码。 */
export function customFormButtonLabel(label: string, tone?: unknown): string {
  return buttonToneMarker(tone) + label;
}

/** 按钮没有 description 槽位；显式 tooltip 优先，否则回退到 description。 */
export function customFormButtonTooltip(node: {
  tooltip?: unknown;
  description?: unknown;
}): string | undefined {
  const tooltip = text(node.tooltip);
  if (tooltip) return tooltip;
  const fallback = text(node.description);
  return fallback || undefined;
}

export type CustomFormDisabled = boolean | ObservableBoolean;

export type CustomFormFieldOptions = {
  description?: string;
  tooltip?: string;
  disabled?: CustomFormDisabled;
  fixedFormatDigits?: number;
};

/** 输入控件：description 与 tooltip 分列；disabled 为 Observable 时原样下传。 */
export function customFormFieldOptions(args: {
  description?: string | undefined;
  tooltip?: string | undefined;
  disabled?: CustomFormDisabled | undefined;
  fixedFormatDigits?: number | undefined;
}): CustomFormFieldOptions {
  const options: CustomFormFieldOptions = {};
  if (args.description) options.description = args.description;
  if (args.tooltip) options.tooltip = args.tooltip;
  if (args.disabled === true) options.disabled = true;
  else if (args.disabled && typeof args.disabled === "object") {
    options.disabled = args.disabled;
  }
  if (
    typeof args.fixedFormatDigits === "number" &&
    Number.isInteger(args.fixedFormatDigits) &&
    args.fixedFormatDigits >= 0
  ) {
    options.fixedFormatDigits = args.fixedFormatDigits;
  }
  return options;
}

export type CustomFormImageOptions = {
  width?: number;
  tooltip?: string;
};

/** 图像可选配置；非法 width 直接丢弃。 */
export function customFormImageOptions(args: {
  width?: number | undefined;
  tooltip?: string | undefined;
}): CustomFormImageOptions {
  const options: CustomFormImageOptions = {};
  if (typeof args.width === "number" && Number.isFinite(args.width) && args.width > 0) {
    options.width = args.width;
  }
  if (args.tooltip) options.tooltip = args.tooltip;
  return options;
}

export type CustomFormDropdownItem = {
  label: string;
  value: number;
  description?: string;
};

/** CustomForm 下拉用下标做 value，同时带上选项 description。 */
export function customFormDropdownItems(
  options: Array<{ label?: unknown; description?: unknown }>,
): CustomFormDropdownItem[] {
  return options.map((option, index) => {
    const item: CustomFormDropdownItem = {
      label: text(option.label),
      value: index,
    };
    const description = text(option.description);
    if (description) item.description = description;
    return item;
  });
}

