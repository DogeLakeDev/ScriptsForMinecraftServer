/**
 * play-gate-policy.ts — 绑定白名单的纯决策（不依赖 @minecraft/server）
 *
 * 原版 allow-list 会在连接阶段拒绝未入名单的玩家，无法做到「先进服再验证」。
 * 因此白名单以 QQ 绑定记录为准：未绑定可进服，但保持访客且不能移动。
 */

/** 与 PlayerPermissionLevel.Operator 的数值一致，避免在纯逻辑里引用脚本枚举。 */
export const OPERATOR_PERMISSION_LEVEL = 2;

/** 访客权限数值。已是访客时不再重复下发 permission 命令，避免刷屏。 */
export const VISITOR_PERMISSION_LEVEL = 0;

/** 绑定前记下的可玩权限。解锁时操作员还原为 operator，其余提升为 member。 */
export type HeldRole = "operator" | "member";

/** 未绑定玩家在聊天栏看到的绑定指引。 */
export const BIND_GATE_PROMPT =
  "需要绑定后才能游玩。请在 QQ 发送「绑定」获取验证码，然后执行 /c:bind，并把验证码发到聊天栏。当前为访客，无法移动。";

/** 暂时查不到绑定状态时的提示。此时仍保持锁定，避免查询失败变成放行。 */
export const BIND_GATE_UNVERIFIED_PROMPT =
  "暂时无法确认绑定状态，已锁定移动。请稍后重试，或在 QQ 发送「绑定」后于游戏内执行 /c:bind。";

/** 同一玩家重复提示的最短间隔。 */
export const PROMPT_INTERVAL_MS = 15_000;

/** 关闭原版准入白名单的命令。新旧 BDS 命令名不同，调用方逐条尝试。 */
export const VANILLA_ALLOWLIST_OFF_COMMANDS = ["allowlist off", "whitelist off"] as const;

/**
 * 把脚本读到的权限等级收成解锁后要恢复的角色。
 * 当前用于进服锁定前快照，避免绑定成功后把操作员降成普通成员。
 */
export function heldRoleFromLevel(level: number | undefined): HeldRole {
  return level === OPERATOR_PERMISSION_LEVEL ? "operator" : "member";
}

/**
 * 生成服务端 permission 命令。名字里的引号去掉，避免打断命令引用。
 * role 为 visitor 时锁定，为 operator/member 时解除锁定。
 */
export function permissionCommand(playerName: string, role: "visitor" | HeldRole): string {
  const safe = playerName.replace(/"/g, "").trim();
  return `permission set "${safe}" ${role}`;
}

/** 距上次提示已超过间隔时才再发，避免聊天刷屏。 */
export function shouldPrompt(lastAt: number, now: number, intervalMs = PROMPT_INTERVAL_MS): boolean {
  return now - lastAt >= intervalMs;
}

/** 相对锚点移动超过约 0.2 格就拉回。用于输入权限未生效时的兜底。 */
export function movedTooFar(dx: number, dy: number, dz: number, minSq = 0.04): boolean {
  return dx * dx + dy * dy + dz * dz >= minSq;
}
