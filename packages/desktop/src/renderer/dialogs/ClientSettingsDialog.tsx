import { useEffect, useState } from "react";
import type { DesktopPreferences } from "../../shared/api.js";
import { Switch } from "../components/controls.js";
import { Modal } from "../components/overlays.js";
import { SettingRow } from "../components/ui.js";

export function ClientSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [prefs, setPrefs] = useState<DesktopPreferences>();
  useEffect(() => {
    if (!open) return;
    void window.sfmc.preferences().then(setPrefs);
  }, [open]);
  const update = (patch: Partial<DesktopPreferences>) => {
    setPrefs((current) => (current ? { ...current, ...patch } : current));
    void window.sfmc.setPreferences(patch).then(setPrefs);
  };
  return (
    <Modal open={open} onClose={onClose} size="sm" icon="settings" title="客户端设置">
      {prefs && (
        <>
          <SettingRow
            label="托盘图标"
            control={<Switch checked={prefs.tray} label="托盘图标" onChange={(tray) => update({ tray })} />}
          />
          <SettingRow
            label="关闭时留在托盘"
            control={
              <Switch
                checked={prefs.closeToTray}
                disabled={!prefs.tray}
                label="关闭时留在托盘"
                onChange={(closeToTray) => update({ closeToTray })}
              />
            }
          />
          <SettingRow
            label="最小化到托盘"
            control={
              <Switch
                checked={prefs.minimizeToTray}
                disabled={!prefs.tray}
                label="最小化到托盘"
                onChange={(minimizeToTray) => update({ minimizeToTray })}
              />
            }
          />
          <SettingRow
            label="开机启动"
            control={
              <Switch
                checked={prefs.openAtLogin}
                label="开机启动"
                onChange={(openAtLogin) => update({ openAtLogin })}
              />
            }
          />
          <SettingRow
            label="开机启动时隐藏窗口"
            control={
              <Switch
                checked={prefs.startHidden}
                disabled={!prefs.tray || !prefs.openAtLogin}
                label="开机启动时隐藏窗口"
                onChange={(startHidden) => update({ startHidden })}
              />
            }
          />
        </>
      )}
    </Modal>
  );
}
