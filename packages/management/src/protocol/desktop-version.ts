/** 桌面版本保留产品版本，修复构建使用 +build.N；界面显示为 0.3.6(1)。 */
export interface DesktopVersion {
  base: string;
  preview?: number;
  build: number;
}

export function parseDesktopVersion(version: string): DesktopVersion | undefined {
  const match =
    /^((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))(?:-preview\.(0|[1-9]\d*))?(?:\+build\.([1-9]\d*))?$/.exec(
      version
    );
  if (!match) return undefined;
  const preview = match[2] === undefined ? undefined : Number(match[2]);
  const build = Number(match[3] ?? 0);
  if (
    ![...match[1]!.split(".").map(Number), build, ...(preview === undefined ? [] : [preview])].every(
      Number.isSafeInteger
    )
  )
    return undefined;
  return { base: match[1]!, ...(preview === undefined ? {} : { preview }), build };
}

export function formatDesktopVersion(version: string): string {
  const parsed = parseDesktopVersion(version);
  if (!parsed) return version;
  const base = `${parsed.base}${parsed.preview === undefined ? "" : `-preview.${parsed.preview}`}`;
  return parsed.build ? `${base}(${parsed.build})` : base;
}

/** SemVer 默认忽略构建元数据，桌面更新还需比较同一产品版本的构建号。 */
export function compareDesktopVersions(a: string, b: string): number {
  const left = parseDesktopVersion(a);
  const right = parseDesktopVersion(b);
  if (!left || !right) throw new Error("非法桌面版本");
  const leftBase = left.base.split(".").map(Number);
  const rightBase = right.base.split(".").map(Number);
  for (let index = 0; index < 3; index++) {
    const difference = leftBase[index]! - rightBase[index]!;
    if (difference) return difference;
  }
  if (left.preview === undefined && right.preview !== undefined) return 1;
  if (left.preview !== undefined && right.preview === undefined) return -1;
  const previewDifference = (left.preview ?? 0) - (right.preview ?? 0);
  return previewDifference || left.build - right.build;
}
