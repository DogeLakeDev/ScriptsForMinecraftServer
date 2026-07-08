/* ---------------------------------------- *\
 *  DogeChat 系统初始化 - 频道化聊天          *
 *  拦截聊天、注册命令                        *
\* ---------------------------------------- */
import { world, system } from "@minecraft/server";
import { Command } from "../libs/Command";
import { registerSystemMsgHandler } from "../libs/Tools";
import { DogeChat } from "./DogeChat";
import { ChatGUI } from "../gui/ChatGUI";
import { HttpDB } from "../libs/HttpDB";
export class ChatSystem {
    static init() {
        console.log(`Initializing ChatSystem...`);
        DogeChat.ensureDefaultChannels();
        HttpDB.checkHealth().then((ok) => {
            if (ok)
                console.info("[DogeChat] 外部数据库已连接，消息将持久化存储。");
            else
                console.warn("[DogeChat] 外部数据库未连接。");
        });
        // 注册系统消息回调（Msg → 系统频道）
        registerSystemMsgHandler((player, text) => {
            DogeChat.sendSystemMessage(player, text);
        });
        console.log(`ChatSystem initialized successfully.`);
    }
    static registerEvents() {
        // 拦截聊天消息 → 重定向到当前频道
        world.beforeEvents.chatSend.subscribe(async (event) => {
            const player = event.sender;
            const message = event.message;
            if (message.startsWith("!") || message.startsWith("！"))
                return;
            event.cancel = true;
            const channel = await DogeChat.getActiveChannel(player);
            if (channel)
                await DogeChat.sendChannelMessage(player, channel.id, message);
        });
        // 玩家进服 → 激活频道并加载历史消息
        world.afterEvents.playerJoin.subscribe((event) => {
            const player = world.getEntity(event.playerId);
            system.run(async () => {
                const channel = await DogeChat.getActiveChannel(player);
                if (channel)
                    await DogeChat.loadChannelHistory(player, channel.id);
            });
        });
    }
    static registerCommands() {
        // !channel — 打开频道管理面板
        Command.register("channel", "chat.use", (player) => {
            if (player)
                ChatGUI.openChannelPanel(player);
        }, "频道管理 - 切换/订阅频道");
        // !ch — 循环切换频道（跳过私聊）
        Command.register("ch", "chat.use", async (player) => {
            if (!player)
                return;
            const next = await DogeChat.cycleChannel(player);
            if (next)
                await DogeChat.loadChannelHistory(player, next.id);
        }, "快速切换频道");
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