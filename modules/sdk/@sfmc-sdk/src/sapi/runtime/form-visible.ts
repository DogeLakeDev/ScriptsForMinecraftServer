/**
 * 合并 MenuNavigator 节可见性与单个控件的 visible。
 *
 * PageBuilder 以前无条件写入节 visible，会盖掉控件自己的隐藏。
 * 控件显式 false 时整项隐藏；其余情况沿用节切换。
 */
export function mergeSectionVisible<T>(
  sectionVisible: T,
  widgetVisible?: boolean | T
): T | false {
  if (widgetVisible === false) return false;
  return sectionVisible;
}
