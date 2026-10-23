import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { PackImportPlan, PackImportOptions } from "@sfmc-bds/management";
import { decidePackInstallPlan, enableInstalledPack, installPackDirectory, readPackManifestInfo, resolvePackRoots, scanDestOccupancy, worldPackParentDir } from "@sfmc-bds/bds-tools/world-packs";
import { ROOT } from "../runtime.js";
import { resolveBdsContext } from "../pack-lifecycle.js";
import { identifier } from "./domain.js";

/** 与 REPL 共用安装决策；先检查整个归档，避免后面的冲突导致前面的包已被写入。 */
async function inspectImport<T>(filename: string, action: (plan: PackImportPlan, install: (force: boolean) => Promise<void>) => Promise<T>): Promise<T> {
  const inbox = path.resolve(ROOT, "packs", "_desktop-inbox");
  const file = path.resolve(inbox, identifier(filename));
  if (!file.startsWith(inbox + path.sep) || !fs.existsSync(file)) throw new Error("世界包尚未上传到实例收件箱");
  const context = resolveBdsContext();
  const resolved = await resolvePackRoots(file);
  try {
    if (!resolved.roots.length) throw new Error("归档不含可识别的世界包");
    const seen = new Set<string>();
    const prepared = resolved.roots.map(source => {
      const info = readPackManifestInfo(source);
      if (!info) throw new Error("世界包 manifest 无效");
      const id = info.uuid.toLowerCase();
      if (seen.has(id)) throw new Error(`归档包含重复的世界包 UUID: ${info.uuid}`);
      seen.add(id);
      const destParent = worldPackParentDir(context.bdsRoot, context.levelName, info.kind);
      const decision = decidePackInstallPlan({ incoming: info, hint: path.basename(source), occupancy: scanDestOccupancy(destParent) });
      return { source, info, destParent, decision };
    });
    const hash = createHash("sha256");
    for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
    hash.update(JSON.stringify({
      context,
      existing: prepared.map(({ info, decision }) => ({
        id: info.uuid,
        dir: decision.kind === "fresh" ? null : decision.dir,
        manifest: decision.kind === "fresh" ? null : fs.readFileSync(path.join(decision.dir, "manifest.json"), "utf8"),
      })),
    }));
    const plan: PackImportPlan = {
      revision: hash.digest("hex"),
      packs: prepared.map(({ info, decision }) => ({
        id: info.uuid, name: info.name, kind: info.kind, version: info.version.join("."),
        action: decision.kind === "fresh" ? "install" : decision.kind === "needConfirm" ? "conflict" : "update",
        ...(decision.kind === "fresh" ? {} : { existing: { name: decision.existing.name, version: decision.existing.version.join(".") } }),
      })),
    };
    return await action(plan, async force => {
      for (const { source, info, destParent } of prepared) {
        const result = await installPackDirectory({ srcDir: source, destParent, force });
        if (!result.ok) throw Object.assign(new Error(result.reason ?? "世界包安装失败"), { code: result.conflict ? "conflict" : "io", details: result.conflict });
        await enableInstalledPack({ ...context, info });
      }
    });
  } finally { resolved.dispose(); }
}

export function planPackImport(filename: string): Promise<PackImportPlan> {
  return inspectImport(filename, async plan => plan);
}

/**
 * 从管理请求取出收件箱文件名。
 * 使用场景：桌面一次拖入或选中多个世界包时传 filenames；旧客户端仍只传 filename。
 */
export function readImportFilenames(params: { filename?: unknown; filenames?: unknown }): string[] {
  if (Array.isArray(params.filenames)) {
    const names = [...new Set(params.filenames.map(value => identifier(value)))];
    if (!names.length) throw new Error("没有要导入的世界包");
    return names;
  }
  return [identifier(params.filename)];
}

/**
 * 按顺序导入多个收件箱文件。
 * 使用场景：批量导入。只有一个文件时仍走 importPack，保留 force 与 revision 的原有校验。
 * 中途失败时，前面已经安装的包保留，错误里带上已导入数量。
 */
export async function importPacks(filenames: string[], options: PackImportOptions = {}) {
  if (filenames.length === 1) {
    const only = filenames[0];
    if (!only) throw new Error("没有要导入的世界包");
    return importPack(only, options);
  }
  const imported: string[] = [];
  for (const name of filenames) {
    try {
      await importPack(name);
      imported.push(name);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code = (error as { code?: unknown }).code;
      throw Object.assign(new Error(imported.length ? `已导入 ${imported.length} 个，继续导入 ${name} 失败：${message}` : message), typeof code === "string" ? { code } : {});
    }
  }
  return { changed: true, restartRequired: true, imported: imported.length };
}

/** force 必须绑定用户看过的归档及已有包版本，排队期间有变化时重新确认。 */
export function importPack(filename: string, options: PackImportOptions = {}) {
  return inspectImport(filename, async (plan, install) => {
    if ((options.force && !options.revision) || (options.revision !== undefined && options.revision !== plan.revision)) {
      throw Object.assign(new Error("导入文件或已安装包已变更，请重新导入并确认"), { code: "conflict" });
    }
    const conflicts = plan.packs.filter(pack => pack.action === "conflict");
    if (conflicts.length && !options.force) {
      throw Object.assign(new Error(`世界包需要确认覆盖：${conflicts.map(pack => `${pack.name}（已有 ${pack.existing!.version}，导入 ${pack.version}）`).join("、")}`), { code: "conflict", details: { conflicts } });
    }
    await install(options.force === true);
    return { changed: true, restartRequired: true };
  });
}
