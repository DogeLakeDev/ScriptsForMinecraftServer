/**
 * tabler-icons.d.ts — Tabler 单图标文件的类型声明
 *
 * 使用场景：icons.tsx 按文件导入 @tabler/icons-react/dist/esm/icons/<Name>.mjs，以免开发服务器加载整个图标库；
 * 该包只为入口文件提供类型，这里把每个单图标文件声明为默认导出的 TablerIcon 组件。
 */
declare module "@tabler/icons-react/dist/esm/icons/*.mjs" {
  import type { TablerIcon } from "@tabler/icons-react";

  /** 单个 Tabler 图标组件 */
  const icon: TablerIcon;
  export default icon;
}
