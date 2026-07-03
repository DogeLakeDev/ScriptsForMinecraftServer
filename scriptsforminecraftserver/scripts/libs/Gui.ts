import { Player, RawMessage, system } from "@minecraft/server";
import { ActionFormData, ModalFormData, ActionFormResponse, ModalFormResponse } from "@minecraft/server-ui";
import { Msg } from "./Tools";

export class Gui {

  // ── 统一重试逻辑 ──

  /**
   * 显示表单并在 UserBusy 时自动轮询重试
   * @param player 目标玩家
   * @param form 表单实例
   * @param title 表单标题（重试提示用）
   * @param retryInterval 重试间隔（tick）
   * @param timeoutTicks 超时时间（tick），默认 160 = 8 秒
   * @returns Promise<ActionFormResponse | ModalFormResponse>
   */
  static showForm(
    player: Player,
    form: ActionFormData | ModalFormData,
    title: string,
    retryInterval = 10,
    timeoutTicks = 160,
  ): Promise<ActionFormResponse | ModalFormResponse> {
    const startTick = system.currentTick;
    return new Promise((resolve) => {
      let notified = false;
      const attempt = () => {
        // 超时检查
        if (system.currentTick - startTick >= timeoutTicks) {
          Msg.warning(`菜单 [${title}] 等待超时（8秒），请重新打开。`, player);
          resolve({ canceled: true } as any);
          return;
        }
        form.show(player).then((res: any) => {
          if (res.canceled && res.cancelationReason === "UserBusy") {
            if (!notified) {
              notified = true;
              Msg.info(`您有一则菜单处理： [${title}] 请关闭当前界面后显示。§7（超时8秒）`, player);
            }
            system.waitTicks(retryInterval).then(attempt);
          } else {
            resolve(res);
          }
        }).catch(() => resolve({ canceled: true } as any));
      };
      attempt();
    });
  }

  // ── confirm ──

  static async confirm(
    player: Player,
    title: string,
    body: string,
    onConfirm: () => void,
    onCancel?: () => void,
  ): Promise<void> {
    const form = new ActionFormData()
      .title(title).body(body)
      .button("确认").button("取消");
    const res = await this.showForm(player, form, title);
    if (res.canceled) { onCancel?.(); return; }
    if ((res as ActionFormResponse).selection === 0) onConfirm();
    else onCancel?.();
  }

  // ── simpleForm / modalForm ──

  static simpleForm(title?: RawMessage | string, body?: RawMessage | string): ActionFormData {
    const form = new ActionFormData();
    if (title !== undefined) form.title(title);
    if (body !== undefined) form.body(body);
    return form;
  }

  static modalForm(title?: RawMessage | string): ModalFormData {
    const form = new ModalFormData();
    if (title !== undefined) form.title(title);
    return form;
  }
}
