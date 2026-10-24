/** 保存与重启分开：仅重启当前正在运行的服务，继续保持已停止的服务关闭。 */
import { useState } from "react";
import { activeTasks, useDesktop } from "../app/desktop.js";
import { Button } from "./controls.js";
import { Tooltip } from "./tooltip.js";
import { Callout } from "./ui.js";

/** 旧平台的同名模块与世界包接口仍会自动停服，升级前只允许查看。 */
export function useManualRestartSupport() {
  const { model } = useDesktop();
  return Boolean(model.handshake?.capabilities.includes("manual-restart"));
}

export function ManualRestartNotice() {
  const supported = useManualRestartSupport();
  const { setPage } = useDesktop();
  if (supported) return null;
  return (
    <Callout
      tone="info"
      title="请先更新平台"
      action={
        <Button size="sm" onClick={() => setPage("updates")}>
          更新平台
        </Button>
      }
    >
    </Callout>
  );
}

export function RestartServicesButton({
  target = "bds",
  disabled = false,
}: {
  target?: "all" | "bds";
  disabled?: boolean;
}) {
  const { model, editable, submit } = useDesktop();
  const supported = useManualRestartSupport();
  const [submitting, setSubmitting] = useState(false);
  const running = model.services.some((row) => row.running && (target === "all" || row.name === target));
  const busy = activeTasks(model).length > 0;
  const label = target === "all" ? "重启服务" : "重启 BDS";
  const reason = !supported
    ? "请先更新平台"
    : disabled
      ? "请先保存或放弃更改"
      : !editable
        ? "当前不可操作"
        : busy
          ? "请等待当前任务完成"
          : !running
            ? ""
            : undefined;
  // 是否禁用与提示文案分开判断：服务未运行时不显示提示（reason 为空串），但按钮仍需禁用。
  const blocked = reason !== undefined;
  const restart = async () => {
    setSubmitting(true);
    try {
      await submit(
        "services.restart",
        { name: target, runningOnly: true, ...(target === "all" ? { reloadConfig: true } : {}) },
        label,
        {
          okText: "重启"
        }
      );
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Tooltip content={reason} wrap>
      <Button icon="restart" disabled={blocked || submitting} onClick={() => void restart()}>
        {label}
      </Button>
    </Tooltip>
  );
}
