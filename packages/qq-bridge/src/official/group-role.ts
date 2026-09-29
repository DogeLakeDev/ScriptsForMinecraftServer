/**
 * group-role.ts — 官方群主/群管身份的短时缓存
 *
 * 群消息事件带 author.member_role；按钮回调 INTERACTION_CREATE 不带角色。
 * 消息处理写入缓存，按钮鉴权先读缓存，未命中再查成员接口。
 */

/** 角色缓存有效期。按钮回调通常紧跟菜单消息，半小时足够覆盖一次管理操作。 */
const ROLE_TTL_MS = 30 * 60 * 1000;

type RoleHit = { admin: boolean; at: number };

/** member_openid → 是否群主/群管。只在本进程内给按钮回调补角色。 */
const roleByMember = new Map<string, RoleHit>();

/**
 * 判断官方角色字段是否为群主或群管。
 * 使用场景：消息事件的 member_role，以及成员查询接口的同名字段。
 */
export function isPrivilegedGroupRole(value: unknown): boolean {
  if (value == null) return false;
  if (Array.isArray(value)) {
    const joined = value.map((item) => String(item).toLowerCase()).join(",");
    return /\b(owner|admin|2|3)\b/.test(joined);
  }
  const role = String(value).toLowerCase();
  return role === "owner" || role === "admin" || role === "2" || role === "3";
}

/**
 * 记下已确认的群角色。
 * 使用场景：解析到 member_role 后，供随后的按钮回调读取。
 */
export function rememberGroupRole(memberOpenid: string, admin: boolean): void {
  const id = memberOpenid.trim();
  if (!id) return;
  roleByMember.set(id, { admin, at: Date.now() });
}

/**
 * 读取未过期的群管缓存。
 * 使用场景：按钮回调没有 member_role 时；没有记录返回 undefined。
 */
export function cachedGroupAdmin(memberOpenid: string): boolean | undefined {
  const hit = roleByMember.get(memberOpenid.trim());
  if (!hit) return undefined;
  if (Date.now() - hit.at > ROLE_TTL_MS) {
    roleByMember.delete(memberOpenid.trim());
    return undefined;
  }
  return hit.admin;
}
