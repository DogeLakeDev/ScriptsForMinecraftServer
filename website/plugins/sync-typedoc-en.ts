import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { RspressPlugin } from "@rspress/core";

export type SyncTypedocEnOptions = {
  zhDir: string;
  enDir: string;
};

function emptyDir(dir: string) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    rmSync(path.join(dir, name), { recursive: true, force: true });
  }
}

function ensureEnReferenceShell(enDir: string) {
  const enRef = path.dirname(enDir);
  mkdirSync(enRef, { recursive: true });
  const enRefMeta = path.join(enRef, "_meta.json");
  if (!existsSync(enRefMeta)) {
    writeFileSync(
      enRefMeta,
      JSON.stringify(
        ["index", { type: "dir", name: "sdk", label: "SDK" }],
        null,
        2
      ) + "\n",
      "utf8"
    );
  }
  const enRefIndex = path.join(enRef, "index.md");
  if (!existsSync(enRefIndex)) {
    writeFileSync(
      enRefIndex,
      [
        "# SDK reference",
        "",
        "Generated TypeDoc for `@sfmc-bds/sdk`. Symbol docs follow the Chinese JSDoc until bilingual comments exist.",
        "",
        "See [SDK](./sdk/).",
        "",
      ].join("\n"),
      "utf8"
    );
  }
}

function sync(opts: SyncTypedocEnOptions) {
  if (!existsSync(opts.zhDir)) return;
  ensureEnReferenceShell(opts.enDir);
  mkdirSync(opts.enDir, { recursive: true });
  emptyDir(opts.enDir);
  cpSync(opts.zhDir, opts.enDir, { recursive: true });
}

/**
 * 仅在生产 afterBuild 补拷 EN（docs-typedoc.mjs 已在仓根同步过一次）。
 * 禁止在 config/dev 里 emptyDir+cp：会删掉上百文件并触发 Rspress watch 连环重建。
 */
export function pluginSyncTypedocEn(opts: SyncTypedocEnOptions): RspressPlugin {
  return {
    name: "sfmc-sync-typedoc-en",
    async afterBuild() {
      if (process.env.NODE_ENV === "development") return;
      sync(opts);
    },
  };
}
