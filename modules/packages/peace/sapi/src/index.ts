/**
 * @sfmc/module-peace — SAPI 侧入口
 *
 * 暴露给 scriptsforminecraftserver 行为包启动期:
 *   - Peace.getInstance():注册事件、生命周期
 *
 * 配套实体 JSON(peace_skeleton/spider/zombie.json)已随本包拷到
 * resource_pack/entities/,stage I 把它们接进 esbuild 打包管线。
 */

export { Peace } from "./Peace.js";