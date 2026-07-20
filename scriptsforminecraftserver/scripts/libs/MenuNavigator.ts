// 临时 shim — Commit 13 删除。
// 旧 MenuNavigator.ts 内部 `import { Msg } from "./Tools.js"`,这里继续从 Sapi 运行时拿 Msg;
// 但 Msg 在 Stage F (core-* 迁移) 之后才实装。本批 (Stage A+B) 把这条 re-export 暂留,
// 以保证 MenuNavigator 单测/类型链不断。
export {
  MenuNavigator,
  FormStatus,
  ObservableBoolean,
  ObservableNumber,
  ObservableString,
  obsStr,
  obsNum,
  obsBool,
} from "@sfmc/sdk/sapi/runtime";
export type { Page, PageBuildFn } from "@sfmc/sdk/sapi/runtime";
