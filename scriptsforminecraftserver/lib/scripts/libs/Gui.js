import { system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
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
    static showForm(player, form, title, retryInterval = 10, timeoutTicks = 160) {
        const startTick = system.currentTick;
        return new Promise((resolve) => {
            let notified = false;
            const attempt = () => {
                // 超时检查
                if (system.currentTick - startTick >= timeoutTicks) {
                    Msg.warning(`菜单 [${title}] 等待超时（8秒），请重新打开。`, player);
                    resolve({ canceled: true });
                    return;
                }
                form.show(player).then((res) => {
                    if (res.canceled && res.cancelationReason === "UserBusy") {
                        if (!notified) {
                            notified = true;
                            Msg.info(`您有一则菜单处理： [${title}] 请关闭当前界面后显示。§7（超时8秒）`, player);
                        }
                        system.waitTicks(retryInterval).then(attempt);
                    }
                    else {
                        resolve(res);
                    }
                }).catch(() => resolve({ canceled: true }));
            };
            attempt();
        });
    }
    // ── confirm ──
    static confirm(player, title, body, onConfirm, onCancel) {
        return __awaiter(this, void 0, void 0, function* () {
            const form = new ActionFormData()
                .title(title).body(body)
                .button("确认").button("取消");
            const res = yield this.showForm(player, form, title);
            if (res.canceled) {
                onCancel === null || onCancel === void 0 ? void 0 : onCancel();
                return;
            }
            if (res.selection === 0)
                onConfirm();
            else
                onCancel === null || onCancel === void 0 ? void 0 : onCancel();
        });
    }
    // ── simpleForm / modalForm ──
    static simpleForm(title, body) {
        const form = new ActionFormData();
        if (title !== undefined)
            form.title(title);
        if (body !== undefined)
            form.body(body);
        return form;
    }
    static modalForm(title) {
        const form = new ModalFormData();
        if (title !== undefined)
            form.title(title);
        return form;
    }
}
//# sourceMappingURL=Gui.js.map