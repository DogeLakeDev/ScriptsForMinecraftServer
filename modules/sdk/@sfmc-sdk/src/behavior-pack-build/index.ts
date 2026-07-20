// @sfmc/sdk/behavior-pack-build — BP 发布工具(esbuild + 资源包拷贝 + manifest 发射)
//
// 阶段 A+B 占位;后续 Stage I (build pipeline) 在此文件内落:
//   - bundle-sapi.mjs   : esbuild 聚合 modules/packages/<enabled>/sapi/src/index.ts
//   - copy-resource-packs.mjs : 把 modules/packages/*/resource_pack/** 拷到 RP
//   - emit-manifest.mjs : 发射 modules/_manifests/module-manifests.json (parsed-aware)
//
// 当前提供最小入口点 + 版本号,让其它代码能 import 但调用为 stub。
export const SFMC_BEHAVIOR_PACK_BUILD_VERSION = "0.1.0" as const;
