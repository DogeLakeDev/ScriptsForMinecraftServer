/* ---------------------------------------- *\
 *  DogeChat 系统初始化 - 频道化聊天          *
 *  拦截聊天、注册命令                        *
\* ---------------------------------------- */
import { world, system } from "@minecraft/server";
import { Command } from "../libs/Command";
import { Permission } from "../libs/Permission";
import { Msg, registerSystemMsgHandler } from "../libs/Tools";
import { DogeChat } from "./DogeChat";
import { ChatGUI } from "../gui/ChatGUI";
export class ChatSystem {
    static init() {
        // 权限
        Permission.register("chat.use", Permission.Any);
        Permission.register("chat.admin", Permission.OP);
        // 初始化频道
        DogeChat.initChannels();
        // 可选：预连接 HttpDB（启动时尝试，失败不阻塞）
        /* HttpDB.checkHealth().then(ok => {
          if (ok) console.info("[DogeChat] 外部数据库已连接，消息将持久化存储。");
          else console.warn("[DogeChat] 外部数据库未连接，使用 Dynamic Property 存储。");
        }); */
        // 注册系统消息回调（Msg → 系统频道）
        registerSystemMsgHandler((player, text) => {
            DogeChat.sendSystemMessage(player, text);
        });
        // 拦截聊天消息 → 重定向到当前频道
        world.beforeEvents.chatSend.subscribe((event) => __awaiter(this, void 0, void 0, function* () {
            const player = event.sender;
            const message = event.message;
            if (message.startsWith("!") || message.startsWith("！"))
                return;
            event.cancel = true;
            const channel = DogeChat.getActiveChannel(player);
            yield DogeChat.sendChannelMessage(player, channel.id, message);
        }));
        // 玩家进服 → 激活频道并加载历史消息
        world.afterEvents.playerJoin.subscribe((event) => {
            const player = world.getEntity(event.playerId);
            system.run(() => __awaiter(this, void 0, void 0, function* () {
                const channel = DogeChat.getActiveChannel(player);
                yield DogeChat.loadChannelHistory(player, channel.id);
            }));
        });
        // 命令注册
        this.registerCommands();
        // 每 5 分钟清理过期红包
        system.runInterval(() => {
            DogeChat.cleanupExpiredRedPackets();
        }, 6000);
    }
    static registerCommands() {
        // !channel — 打开频道管理面板
        Command.register("channel", "chat.use", (player) => {
            if (player)
                ChatGUI.openChannelPanel(player);
        }, "频道管理 - 切换/订阅频道");
        // !ch — 循环切换频道（跳过私聊）
        Command.register("ch", "chat.use", (player) => __awaiter(this, void 0, void 0, function* () {
            if (!player)
                return;
            const next = DogeChat.cycleChannel(player);
            Msg.info(`已切换到频道: §e${next.prefix}`, player);
            yield DogeChat.loadChannelHistory(player, next.id);
        }), "快速切换频道");
        // !msg — 快捷私聊
        Command.register("msg", "chat.use", (player) => {
            if (player)
                ChatGUI.openPrivateChatPanel(player);
        }, "快捷私聊");
        // !lo — 发送定位
        Command.register("lo", "chat.use", (player) => {
            if (player)
                ChatGUI.sendLocation(player);
        }, "发送当前位置到当前频道");
        // !tp — 发送传送邀请
        Command.register("tp", "chat.use", (player) => {
            if (player)
                ChatGUI.sendTeleportInvite(player);
        }, "发送传送邀请");
        // !hongbao — 红包面板（含领取）
        Command.register("hongbao", "chat.use", (player) => {
            if (player)
                ChatGUI.openRedPacketPanel(player);
        }, "红包 - 查看/领取红包");
        // !hb — 快捷发送红包（直达发送对话框）
        Command.register("hb", "chat.use", (player) => {
            if (player)
                ChatGUI.sendRedPacketQuick(player);
        }, "发送红包");
    }
}
//# sourceMappingURL=ChatSystem.js.map