/**
 * controls.tsx — 基于 Base UI 的操作与表单原语（SnowUI 视觉）
 *
 * 使用场景：所有页面与对话框的按钮、输入框、选择器、开关、复选框、分段控件、字段标签都从这里取用。
 * 页面只依赖这些组件的语义化属性（variant / size / options），不直接拼装 @base-ui/react 的部件结构（DIP）；
 * 视觉集中在 styles/controls.css（DRY）。可访问性（键盘导航、ARIA、与 Field 的标签关联）由 Base UI 提供。
 */
import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { Field as BaseField } from "@base-ui/react/field";
import { Input as BaseInput } from "@base-ui/react/input";
import { NumberField } from "@base-ui/react/number-field";
import { Select as BaseSelect } from "@base-ui/react/select";
import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { Tabs } from "@base-ui/react/tabs";
import { useState, type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type ReactNode, type Ref, type RefObject } from "react";
import { cx } from "../lib/cx.js";
import { Icon, type IconName } from "./icons.js";
import { Tooltip } from "./tooltip.js";

/** 控件尺寸：sm 24px（工具栏、行内操作）/ md 32px（默认）/ lg 40px（引导页主操作） */
export type ControlSize = "sm" | "md" | "lg";

/** 按钮变体：primary 单色实心 / secondary 浅填充 / ghost 透明 / danger 红色实心 / danger-soft 红字浅底 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-soft";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: ButtonVariant;
  size?: ControlSize;
  /** 前置图标 */
  icon?: IconName;
  /** 后置图标（如"下一步 →"） */
  iconEnd?: IconName;
  /** 加载中：前置图标替换为旋转指示并禁用按钮 */
  loading?: boolean;
  /** 撑满父容器宽度 */
  block?: boolean;
  children?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

/** 文字按钮。可作为 Base UI 触发器的 render 目标（透传 ref 与事件属性） */
export function Button({ variant = "secondary", size = "md", icon, iconEnd, loading, block, children, className, disabled, type = "button", ref, ...rest }: ButtonProps) {
  const iconSize = size === "sm" ? 14 : 16;
  const hasLabel = children !== undefined && children !== null && children !== false;
  return (
    <button
      ref={ref}
      type={type}
      className={cx("btn", `btn-${variant}`, `btn-${size}`, !hasLabel && "btn-square", block && "btn-block", loading && "is-loading", className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Icon name="loader" size={iconSize} spin /> : icon && <Icon name={icon} size={iconSize} />}
      {hasLabel && <span className="btn-label">{children}</span>}
      {iconEnd && !loading && <Icon name={iconEnd} size={iconSize} />}
    </button>
  );
}

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: IconName;
  /** 无障碍名称，同时作为默认悬浮提示 */
  label: string;
  /** sm 24px（SnowUI 标题栏图标位）/ md 32px */
  size?: "sm" | "md";
  variant?: "ghost" | "secondary";
  /** 切换型按钮的按下状态（例如右侧栏开关） */
  active?: boolean;
  danger?: boolean;
  /** 角标：数字显示计数，true 显示小圆点 */
  badge?: number | boolean;
  /** 自定义提示内容；false 不显示提示 */
  tooltip?: ReactNode | false;
  mirrored?: boolean;
  spin?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

/** 方形图标按钮：默认带悬浮提示 */
export function IconButton({ icon, label, size = "md", variant = "ghost", active, danger, badge, tooltip, mirrored, spin, className, type = "button", ref, ...rest }: IconButtonProps) {
  const button = (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      aria-pressed={active}
      className={cx("icon-btn", `icon-btn-${size}`, `icon-btn-${variant}`, active && "active", danger && "danger", className)}
      {...rest}
    >
      <Icon name={icon} size={16} mirrored={mirrored} spin={spin} />
      {badge ? <span className={cx("icon-btn-badge", typeof badge !== "number" && "dot")}>{typeof badge === "number" ? (badge > 99 ? "99+" : badge) : null}</span> : null}
    </button>
  );
  if (tooltip === false) return button;
  return <Tooltip content={tooltip ?? label}>{button}</Tooltip>;
}

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "onChange" | "value" | "defaultValue" | "prefix"> {
  value: string;
  onChange?: (value: string) => void;
  /** 前置图标 */
  icon?: IconName;
  /** 后置内容（清除按钮、快捷键提示、单位） */
  suffix?: ReactNode;
  size?: ControlSize;
  /** 等宽字体（路径、XUID、端口） */
  mono?: boolean;
  invalid?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  /** filled 浅填充（默认，SnowUI 搜索框样式）/ outline 描边（用于已在填充面上的输入框） */
  variant?: "filled" | "outline";
  style?: CSSProperties;
}

/** 单行文本输入：外层容器承载图标与后缀，内层为 Base UI Input（可与 Field 自动关联标签） */
export function TextInput({ value, onChange, icon, suffix, size = "md", mono, invalid, className, inputRef, variant = "filled", style, disabled, ...rest }: TextInputProps) {
  return (
    <span className={cx("input", `input-${size}`, `input-${variant}`, invalid && "invalid", disabled && "disabled", className)} style={style}>
      {icon && <Icon name={icon} size={size === "sm" ? 14 : 16} className="input-icon" />}
      <BaseInput
        ref={inputRef as Ref<HTMLElement>}
        value={value}
        disabled={disabled}
        onValueChange={(next) => onChange?.(next)}
        className={cx("input-field", mono && "mono")}
        aria-invalid={invalid || undefined}
        {...rest}
      />
      {suffix && <span className="input-suffix">{suffix}</span>}
    </span>
  );
}

/** 搜索输入：放大镜图标 + 有内容时显示清除按钮，否则显示快捷键提示 */
export function SearchInput({ value, onChange, hint, ...rest }: Omit<TextInputProps, "icon" | "suffix" | "onChange"> & { onChange: (value: string) => void; hint?: ReactNode }) {
  return (
    <TextInput
      {...rest}
      value={value}
      onChange={onChange}
      icon="search"
      type="search"
      suffix={value ? (
        <button type="button" className="input-clear" aria-label="清除" onClick={() => onChange("")}><Icon name="x" size={12} /></button>
      ) : hint}
      onKeyDown={(event) => {
        if (event.key === "Escape" && value) { event.stopPropagation(); onChange(""); }
        rest.onKeyDown?.(event);
      }}
    />
  );
}

/** 密码输入：可切换明文显示 */
export function PasswordInput(props: Omit<TextInputProps, "type" | "suffix">) {
  const [reveal, setReveal] = useState(false);
  return (
    <TextInput
      {...props}
      type={reveal ? "text" : "password"}
      autoComplete="off"
      spellCheck={false}
      suffix={<button type="button" className="input-clear" aria-label={reveal ? "隐藏" : "显示"} aria-pressed={reveal} onClick={() => setReveal(!reveal)}><Icon name={reveal ? "eye" : "lock"} size={14} /></button>}
    />
  );
}

/** 数字输入：Base UI NumberField，支持键盘上下键、范围约束与步进按钮；端口等编号默认不分组（19132 而非 19,132） */
export function NumberInput({ value, onChange, min, max, step = 1, integer, disabled, size = "md", width, invalid, id }: { value: number | null; onChange: (value: number | null) => void; min?: number; max?: number; step?: number; integer?: boolean; disabled?: boolean; size?: ControlSize; width?: number | string; invalid?: boolean; id?: string }) {
  return (
    <NumberField.Root id={id} value={value} onValueChange={(next) => onChange(next)} min={min} max={max} step={step} disabled={disabled} format={integer ? { useGrouping: false, maximumFractionDigits: 0 } : { useGrouping: false }} className="number-field">
      <NumberField.Group className={cx("input", `input-${size}`, "input-filled", invalid && "invalid", disabled && "disabled")} style={width ? { width } : undefined}>
        <NumberField.Input className="input-field mono" />
        <span className="number-steps">
          <NumberField.Decrement className="number-step" aria-label="减少"><Icon name="minus" size={12} /></NumberField.Decrement>
          <NumberField.Increment className="number-step" aria-label="增加"><Icon name="plus" size={12} /></NumberField.Increment>
        </span>
      </NumberField.Group>
    </NumberField.Root>
  );
}

/** 下拉选项 */
export interface SelectOption<T extends string | number> {
  value: T;
  label: ReactNode;
  /** 选项下方的说明 */
  description?: ReactNode;
  icon?: IconName;
  disabled?: boolean;
}

/** 下拉选择：弹层使用与菜单一致的毛玻璃样式，选中项带对勾 */
export function Select<T extends string | number>({ value, onChange, options, placeholder = "请选择", disabled, size = "md", width, className, invalid, label, variant = "filled", id }: { value: T | undefined; onChange: (value: T) => void; options: SelectOption<T>[]; placeholder?: string; disabled?: boolean; size?: ControlSize; width?: number | string; className?: string; invalid?: boolean; label?: string; variant?: "filled" | "outline" | "ghost"; id?: string }) {
  const items = options.map((option) => ({ value: option.value, label: option.label }));
  return (
    <BaseSelect.Root id={id} value={value ?? null} onValueChange={(next: unknown) => { if (next !== null && next !== undefined) onChange(next as T); }} items={items} disabled={disabled}>
      <BaseSelect.Trigger className={cx("input", "select-trigger", `input-${size}`, `input-${variant}`, invalid && "invalid", disabled && "disabled", className)} style={width ? { width } : undefined} aria-label={label}>
        <BaseSelect.Value className="select-value" placeholder={placeholder} />
        <BaseSelect.Icon className="select-icon"><Icon name="chevronDown" size={12} /></BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner className="pop-positioner" sideOffset={6} align="start" alignItemWithTrigger={false}>
          <BaseSelect.Popup className="pop menu select-popup">
            <BaseSelect.List>
              {options.map((option) => (
                <BaseSelect.Item key={String(option.value)} value={option.value} disabled={option.disabled} className="menu-item">
                  {option.icon && <Icon name={option.icon} size={16} className="menu-item-icon" />}
                  <span className="menu-item-text">
                    <BaseSelect.ItemText className="menu-item-label">{option.label}</BaseSelect.ItemText>
                    {option.description && <small className="menu-item-desc">{option.description}</small>}
                  </span>
                  <BaseSelect.ItemIndicator className="menu-item-check"><Icon name="check" size={14} /></BaseSelect.ItemIndicator>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}

/** 开关：sm 用于列表行内，md 用于设置项 */
export function Switch({ checked, onChange, disabled, size = "md", label, id }: { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; size?: "sm" | "md"; label?: string; id?: string }) {
  return (
    <BaseSwitch.Root id={id} checked={checked} onCheckedChange={(next) => onChange(next)} disabled={disabled} className={cx("switch", `switch-${size}`)} aria-label={label}>
      <BaseSwitch.Thumb className="switch-thumb" />
    </BaseSwitch.Root>
  );
}

/** 复选框（带可点击的文字标签） */
export function Checkbox({ checked, onChange, disabled, children }: { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; children?: ReactNode }) {
  return (
    <label className={cx("checkbox-row", disabled && "disabled")}>
      <BaseCheckbox.Root checked={checked} onCheckedChange={(next) => onChange(next)} disabled={disabled} className="checkbox">
        <BaseCheckbox.Indicator className="checkbox-indicator"><Icon name="check" size={12} weight="bold" /></BaseCheckbox.Indicator>
      </BaseCheckbox.Root>
      {children && <span className="checkbox-label">{children}</span>}
    </label>
  );
}

/** 分段选项 */
export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: IconName;
  /** 选项后的计数徽标 */
  count?: number;
  /** 计数徽标语气（例如源码视图的错误数） */
  countTone?: "danger";
  disabled?: boolean;
}

/**
 * 分段控件（Base UI Tabs 实现，带滑动指示块）。
 * variant="pill"：浅填充轨道 + 白色滑块（视图切换、筛选）；variant="text"：SnowUI 文字标签页（选中为 100% 文字色，其余 40%）。
 */
export function Segmented<T extends string>({ value, onChange, options, size = "md", variant = "pill", label, className }: { value: T; onChange: (value: T) => void; options: SegmentOption<T>[]; size?: "sm" | "md"; variant?: "pill" | "text"; label?: string; className?: string }) {
  return (
    <Tabs.Root value={value} onValueChange={(next) => onChange(next as T)} className={cx("segmented", `segmented-${variant}`, `segmented-${size}`, className)}>
      <Tabs.List className="segmented-list" aria-label={label}>
        {options.map((option) => (
          <Tabs.Tab key={option.value} value={option.value} disabled={option.disabled} className="segmented-tab">
            {option.icon && <Icon name={option.icon} size={14} />}
            <span>{option.label}</span>
            {option.count !== undefined && <span className={cx("segmented-count", option.countTone === "danger" && "danger")}>{option.count}</span>}
          </Tabs.Tab>
        ))}
        <Tabs.Indicator className="segmented-indicator" />
      </Tabs.List>
    </Tabs.Root>
  );
}

/**
 * 表单字段：标签 + 控件 + 说明/错误。基于 Base UI Field，标签会自动关联到内部的 Base UI 控件。
 * 使用场景：实例设置、登录、初始化向导、玩家条目编辑等对话框表单。
 */
export function Field({ label, description, error, required, children, className }: { label?: ReactNode; description?: ReactNode; error?: ReactNode; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <BaseField.Root invalid={Boolean(error)} className={cx("field", className)}>
      {label && (
        <BaseField.Label className="field-label">
          {label}
          {required && <span className="field-required" aria-hidden="true">*</span>}
        </BaseField.Label>
      )}
      {children}
      {error ? (
        <div className="field-error" role="alert"><Icon name="alert" size={12} />{error}</div>
      ) : description ? (
        <BaseField.Description className="field-desc">{description}</BaseField.Description>
      ) : null}
    </BaseField.Root>
  );
}
