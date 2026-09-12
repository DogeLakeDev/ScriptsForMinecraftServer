/**
 * 菜单面包屑栈：前进压入，回到已访问页则裁掉后面的段。
 */

/** 前进到新页则压栈；目标已在栈中则回退到该页。 */
export function pushOrRewind(stack: string[], target: string): string[] {
  const index = stack.lastIndexOf(target);
  if (index >= 0) return stack.slice(0, index + 1);
  return [...stack, target];
}

/** 替换栈顶；目标已在栈中则回退到该页。 */
export function replaceOrRewind(stack: string[], target: string): string[] {
  const index = stack.lastIndexOf(target);
  if (index >= 0) return stack.slice(0, index + 1);
  if (stack.length === 0) return [target];
  return [...stack.slice(0, -1), target];
}

/** 返回上一级；根页保持不动。 */
export function popHistory(stack: string[]): string[] {
  if (stack.length <= 1) return stack.slice();
  return stack.slice(0, -1);
}

/** 栈上的页面都要参与构建，返回上一级时才不会露出空白页面。 */
export function shouldRenderScreen(
  screenId: string,
  currentScreen: string,
  history: readonly string[],
): boolean {
  return currentScreen === screenId || history.includes(screenId);
}
