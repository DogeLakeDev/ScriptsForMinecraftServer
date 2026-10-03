import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DesktopUpdateInfo } from "../../shared/api.js";
import { errorText } from "../lib/format.js";

export interface DesktopUpdateState { info: DesktopUpdateInfo | undefined; checking: boolean; error: string; check: () => Promise<void> }
/** 软件更新状态独立于实例连接；启动、每小时及打开关于时检查。 */
export function useDesktopUpdate(): DesktopUpdateState {
  const [info, setInfo] = useState<DesktopUpdateInfo>();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef<Promise<void> | undefined>(undefined);
  const check = useCallback(() => {
    if (pending.current) return pending.current;
    setChecking(true); setError("");
    const action = window.sfmc.update("check").then(value => setInfo(value as DesktopUpdateInfo)).catch(reason => setError(errorText(reason))).finally(() => { pending.current = undefined; setChecking(false); });
    pending.current = action;
    return action;
  }, []);
  useEffect(() => {
    void check();
    const timer = setInterval(() => void check(), 60 * 60_000);
    return () => clearInterval(timer);
  }, [check]);
  return useMemo(() => ({ info, checking, error, check }), [info, checking, error, check]);
}
