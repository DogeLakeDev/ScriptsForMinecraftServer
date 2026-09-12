/**
 * FixtureSwitcher.tsx — 画布顶部的预览场景切换器。
 *
 * 选项 = 基础场景（.ui-studio/preview.fixture.json）+ 场景目录下的各场景文件；
 * 切换由 App 重建预览会话（fixture 变化会影响 player/params/data 初值）。
 */

import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/react";
import { Check, ChevronsUpDown, FlaskConical } from "lucide-react";
import { FIXTURE_DIR, FIXTURE_FILE } from "../store/project";

/** 场景文件的展示名：基础场景固定文案，其余取文件名去扩展名。 */
export function fixtureLabel(file: string): string {
  if (file === FIXTURE_FILE) return "基础场景";
  const name = file.slice(FIXTURE_DIR.length + 1).replace(/\.json$/, "");
  return name || file;
}

export function FixtureSwitcher({
  files,
  active,
  onSwitch,
}: {
  /** 全部可切换的 fixture 文件（基础场景 + 场景目录）。 */
  files: string[];
  active: string;
  onSwitch(file: string): void;
}) {
  return (
    <div className="fixture-switcher" title="预览场景（fixture）">
      <FlaskConical size={13} className="fixture-switcher-icon" />
      <Listbox value={active} onChange={onSwitch}>
        <ListboxButton className="fixture-switcher-btn">
          <span>{fixtureLabel(active)}</span>
          <ChevronsUpDown size={12} />
        </ListboxButton>
        <ListboxOptions anchor="bottom start" className="insp-listbox">
          {files.map((file) => (
            <ListboxOption key={file} value={file} className="insp-listbox-option">
              <span className="insp-listbox-check">
                {file === active ? <Check size={12} /> : null}
              </span>
              <span className="insp-listbox-path">{fixtureLabel(file)}</span>
              <span className="insp-listbox-hint">{file}</span>
            </ListboxOption>
          ))}
        </ListboxOptions>
      </Listbox>
    </div>
  );
}
