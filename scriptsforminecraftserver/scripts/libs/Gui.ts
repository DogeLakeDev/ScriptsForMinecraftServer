import { Player, system } from "@minecraft/server";
import {
  CustomForm,
  DataDrivenScreenClosedReason,
  ObservableBoolean,
  ObservableNumber,
  ObservableString,
} from "@minecraft/server-ui";
import { Msg } from "./Tools";

export { ObservableBoolean, ObservableNumber, ObservableString };

export class Gui {
  static async showForm(
    player: Player,
    form: CustomForm,
    title: string,
    retryInterval = 10,
    timeoutTicks = 160
  ): Promise<DataDrivenScreenClosedReason> {
    const startTick = system.currentTick;
    let notified = false;
    while (true) {
      if (system.currentTick - startTick >= timeoutTicks) {
        Msg.warning(`菜单 [${title}] 等待超时（8秒），请重新打开。`, player);
        return DataDrivenScreenClosedReason.ClientClosed;
      }
      try {
        const reason = await form.show();
        if (reason === DataDrivenScreenClosedReason.UserBusy) {
          if (!notified) {
            notified = true;
            Msg.info(`您有一则菜单处理： [${title}] 请关闭当前界面后显示。§7（超时8秒）`, player);
          }
          await system.waitTicks(retryInterval);
          continue;
        }
        return reason;
      } catch {
        return DataDrivenScreenClosedReason.ClientClosed;
      }
    }
  }

  static async confirm(
    player: Player,
    title: string,
    body: string,
    onConfirm: () => void,
    onCancel?: () => void
  ): Promise<void> {
    let confirmed = false;
    const form = new CustomForm(player, title)
      .label(body)
      .button("确认", () => {
        confirmed = true;
        onConfirm();
      })
      .closeButton();
    await this.showForm(player, form, title);
    if (!confirmed) onCancel?.();
  }
}
