/**
 * methods.ts — 网关放行的管理方法
 *
 * 使用场景：bridge.ts 在把请求帧写入 `sfmc manage --stdio` 前查表，不在表内的方法直接回 unsupported。
 * 这里只开放小程序界面会用到的方法；初始化部署、接入升级、开机启动脚本等需要本机交互的流程仍交给桌面端。
 * 小程序新增功能时在此追加方法名即可（OCP），类型约束保证方法名与协议表一致。
 */
import type { ManagementMethod } from "@sfmc-bds/management";

export const GATEWAY_METHODS: ReadonlySet<string> = new Set<ManagementMethod>([
  "handshake",
  "events.subscribe",
  "services.list",
  "services.start",
  "services.stop",
  "services.restart",
  "services.send",
  "logs.tail",
  "logs.delete",
  "modules.list",
  "modules.search",
  "modules.install",
  "modules.uninstall",
  "modules.toggle",
  "config.list",
  "config.read",
  "config.save",
  "packs.list",
  "packs.icon",
  "packs.import.plan",
  "packs.import",
  "packs.toggle",
  "packs.uninstall",
  "players.list",
  "players.apply",
  "metrics.read",
  "activity.query",
  "activity.stats",
  "scoreboard.read",
  "scoreboard.apply",
  "updates.check",
  "updates.run",
  "operations.list",
  "operations.get",
  "backups.list",
  "backups.create",
  "backups.restore",
  "backups.delete",
]);
