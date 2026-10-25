/**
 * DeviceLoginPanel.tsx — 实例设置对话框中的“用小程序登录”
 *
 * 使用场景：连接方式为「管理网关」时显示在访问令牌下方。点击后向网关发起设备登录，
 * 展示二维码与 6 位登录码；管理员在小程序「我的 → 登录桌面端」扫码或输入登录码批准后，
 * 把拿到的设备凭证交给对话框填入访问令牌（保存实例时与手填令牌走同一条保存路径）。
 */
import { useEffect, useRef, useState } from "react";
import type { DeviceLoginTicket } from "../../shared/api.js";
import { Button } from "../components/controls.js";
import { Callout } from "../components/ui.js";
import { errorText } from "../lib/format.js";

/** 面板阶段：idle 未发起 / waiting 等待批准 / done 已获授权 / failed 被拒绝、过期或出错 */
type Phase = "idle" | "waiting" | "done" | "failed";

/** 剩余时间文案 */
function remainText(expiresAt: number, now: number): string {
  const seconds = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function DeviceLoginPanel({ endpoint, onCredential }: {
  /** 当前填写的网关地址（未规整；无效时由主进程报错） */
  endpoint: string;
  /** 获批后回调：credential 作为访问令牌，approvedByName 为批准的管理员游戏名 */
  onCredential: (credential: string, approvedByName: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [ticket, setTicket] = useState<DeviceLoginTicket | null>(null);
  const [message, setMessage] = useState("");
  const [starting, setStarting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  /** 当前轮询所属的 deviceId；重新发起或卸载后旧轮询自行结束 */
  const active = useRef("");

  // 卸载（关闭对话框 / 切换连接方式）时放弃等待
  useEffect(() => () => {
    if (active.current) void window.sfmc.deviceLoginCancel(active.current);
    active.current = "";
  }, []);

  // 倒计时
  useEffect(() => {
    if (phase !== "waiting") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  /** 按网关建议的间隔轮询，直到批准 / 拒绝 / 过期 */
  const poll = async (current: DeviceLoginTicket) => {
    while (active.current === current.deviceId) {
      await new Promise((resolve) => setTimeout(resolve, current.intervalMs));
      if (active.current !== current.deviceId) return;
      try {
        const result = await window.sfmc.deviceLoginPoll(current.deviceId);
        if (active.current !== current.deviceId) return;
        if (result.status === "pending") continue;
        active.current = "";
        if (result.status === "approved") {
          setPhase("done");
          setMessage(`已获得管理员 ${result.approvedByName || "（未知）"} 的授权，有效期至 ${new Date(result.expiresAt).toLocaleDateString()}。保存实例后生效。`);
          onCredential(result.credential, result.approvedByName);
        } else {
          setPhase("failed");
          setMessage(result.status === "denied" ? "管理员拒绝了这次登录。" : "登录请求已过期，请重新发起。");
        }
        return;
      } catch (error) {
        // 网络抖动不终止等待；请求本身过期由网关返回 expired
        setMessage(errorText(error));
      }
    }
  };

  const start = async () => {
    if (active.current) void window.sfmc.deviceLoginCancel(active.current);
    active.current = "";
    setStarting(true);
    setMessage("");
    try {
      const next = await window.sfmc.deviceLoginStart(endpoint);
      active.current = next.deviceId;
      setTicket(next);
      setNow(Date.now());
      setPhase("waiting");
      void poll(next);
    } catch (error) {
      setPhase("failed");
      setMessage(errorText(error));
    } finally {
      setStarting(false);
    }
  };

  const cancel = () => {
    if (active.current) void window.sfmc.deviceLoginCancel(active.current);
    active.current = "";
    setPhase("idle");
    setTicket(null);
    setMessage("");
  };

  if (phase === "waiting" && ticket) {
    return (
      <div className="device-login">
        <img className="device-login-qr" src={ticket.qrDataUrl} alt="小程序登录二维码" width={160} height={160} />
        <div className="device-login-body">
          <div className="device-login-title">用小程序扫码登录</div>
          <div className="device-login-text">在小程序「我的 → 登录桌面端」扫描二维码，或输入登录码：</div>
          <div className="device-login-code">{ticket.userCode}</div>
          <div className="device-login-text">{remainText(ticket.expiresAt, now)} 后失效 · 需要游戏内 3 级管理员批准</div>
          {message && <div className="device-login-text tone-warning">{message}</div>}
          <div>
            <Button size="sm" variant="ghost" icon="x" onClick={cancel}>取消</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {phase === "done" && <Callout tone="success" title="小程序授权成功">{message}</Callout>}
      {phase === "failed" && <Callout tone="danger" title="未完成登录">{message}</Callout>}
      <div>
        <Button icon="monitor" loading={starting} disabled={!endpoint.trim()} onClick={() => void start()}>
          {phase === "idle" ? "用小程序登录" : "重新用小程序登录"}
        </Button>
      </div>
    </>
  );
}
