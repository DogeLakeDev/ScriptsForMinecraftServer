/**
 * Msg — SAPI 系统消息显示。
 *
 * 历史实现在 scriptsforminecraftserver/scripts/libs/Tools.ts 内部(类名 Msg)。
 * 本批 (Stage A+B) 仅占位:把所有消息打到 console,玩家对象参数被忽略。
 * Stage F (core-* 迁移) 之后实装玩家 system channel 转发 + 声音 + 颜色前缀。
 */
import type { Player } from "@minecraft/server";

export const Msg = {
  info(msg: string, _player?: Player): void {
    console.log(`[info] ${msg}`);
  },
  success(msg: string, _player?: Player): void {
    console.log(`[success] ${msg}`);
  },
  warning(msg: string, _player?: Player): void {
    console.warn(`[warning] ${msg}`);
  },
  error(msg: string, _player?: Player): void {
    console.error(`[error] ${msg}`);
  },
  tips(msg: string, _player?: Player): void {
    console.log(`[tips] ${msg}`);
  },
};
