/**
 * util.ts — qq-link 纯逻辑工具函数
 */

/** 平台 error 码 → 玩家可读文案 */
export function formatConfirmError(error: string | undefined): string {
  switch (error) {
    case "invalid_code":
      return "绑定码无效，请回 QQ 重新申请「绑定」";
    case "code_expired":
      return "绑定码已过期，请回 QQ 重新申请";
    case "qq_already_bound":
      return "该 QQ 已绑定其他玩家，请先在 QQ 侧「解绑」";
    case "player_already_bound":
      return "你已绑定其他 QQ，请先解绑后再试";
    case "network_error":
      return "无法连接数据库服务，请稍后重试";
    default:
      return "绑定失败，请稍后重试";
  }
}
