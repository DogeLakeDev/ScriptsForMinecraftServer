/**
 * version.ts — 管理协议版本常量
 *
 * 使用场景：握手（handshake）时服务端返回本版本，桌面端据此判断协议兼容性。
 * 协议出现不兼容变更（帧结构、方法语义、结果信封）时递增；
 * 仅新增方法/能力（OCP 扩展）不需要递增，由 capabilities 列表表达。
 */
export const MANAGEMENT_PROTOCOL_VERSION = 1;
