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
      当前平台尚不支持保存后手动重启，更新前可查看内容。
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
            ? "服务尚未运行，下次启动时将读取已保存的更改"
            : undefined;
  const restart = async () => {
    setSubmitting(true);
    try {
      await submit(
        "services.restart",
        { name: target, runningOnly: true, ...(target === "all" ? { reloadConfig: true } : {}) },
        label,
        {
          okText: "重启",
          description:
            target === "all"
              ? "将重新读取已保存的配置，并按依赖顺序重启当前运行的服务。玩家连接会暂时中断。"
              : "将重启 BDS，加载已保存的模块与世界包更改。玩家连接会暂时中断。",
        }
      );
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Tooltip content={reason} wrap>
      <Button icon="restart" disabled={Boolean(reason) || submitting} onClick={() => void restart()}>
        {label}
      </Button>
    </Tooltip>
  );
}
