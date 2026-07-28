# REPL Welcome：meta 同步逐字点亮

日期：2026-07-28  
范围：`sfmc/src/repl.ts` 欢迎动画  
方案：A — 同步点亮

## 背景

当前 `playWelcomeAnimation` 中：

- 底线用 `lineProgress` 逐格伸长 `─`
- meta 整行在 `c.text` / `c.dim` 间闪烁

期望：meta 与底线共用同一进度，从左到右逐字点亮，去掉整行闪烁。

## 行为规格

1. **单一进度**：`progress` 从 `0` 增至 `lineLength`（`meta` 显示宽度 + 3，与现逻辑一致）。
2. **底线**：每帧渲染 `"─".repeat(min(progress, lineLength))`（与现行为一致）。
3. **meta 点亮**：
   - 将最终样式 meta 拆成「显示列」序列（按字符计宽；非 ASCII 占 2 列，与 `getDisplayWidth` 一致）。
   - `progress` 对应已点亮的显示列数（上限为 meta 显示宽度）。
   - 已点亮字符保留最终样式：首字母 `S`/`F`/`M`/`c` 用 `c.text`，其余用 `c.dim`（与现 `meta` 常量一致）。
   - 未点亮字符用比 `c.dim` 更暗的样式（`chalk.hex(T.subtle)`，即 `#4b5263`），与已点亮的 dim 段可区分；不得闪烁。
4. **结束态**：`progress >= lineLength` 后清屏绘制最终帧：`c.bold(meta)` + 完整底线，再空两行，resolve Promise。
5. **帧间隔**：保持约 `5ms`；去掉 `isBright` 切换。
6. **非 TTY / 跳过**：若现有路径在无动画时直接打印欢迎语，行为不变（本次只改 `playWelcomeAnimation` 内部）。

## 实现要点

| 项 | 说明 |
|----|------|
| 文件 | 仅 `sfmc/src/repl.ts` |
| 新增辅助 | 例如 `buildMetaAtProgress(litColumns: number): string`，从纯文本 + 强调下标生成 ANSI |
| 纯文本源 | `Scripts For Minecraft Server v${pkg.version}`（与现 meta 内容一致） |
| 强调下标 | `S`(0)、`F`、`M`、`c`（「Minecraft」中的 `c`） |
| 宽度对齐 | 点亮进度按**显示列**推进，使 meta 前沿与底线伸长在观感上同步；空格也占 1 列 |

## 非目标

- 不改 ASCII logo / 顶行快捷键提示文案
- 不改主题色板、帧间隔产品化配置
- 不引入依赖；不做浏览器/Ink 重写

## 验证

1. `npm run build -w sfmc`（或项目惯用的 sfmc 构建）通过。
2. 手动：`node index.js`（或 `node sfmc/dist/...`）进 REPL，观察欢迎动画：meta 与底线同步从左点亮，结束后定格加粗完整 meta，无整行闪烁。

## 风险

- ANSI 与显示宽度混算错误会导致点亮超前/落后底线：必须以去 ANSI 后的列宽为进度单位。
- 中文乱码：本改动字符串为英文 + 版本号，注释用中文 UTF-8。
