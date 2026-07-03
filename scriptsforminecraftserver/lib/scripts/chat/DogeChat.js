/* ---------------------------------------- *\
 *  Name        :  DogeChat 消息系统         *
 *  Description :  频道化聊天 + 消息同步      *
 *  Version     :  3.0.0                    *
 *  Author      :  Shiroha7z               *
\* ---------------------------------------- */
import { world } from "@minecraft/server";
import { Msg } from "../libs/Tools";
import { Money } from "../libs/Money";
import { HttpDB } from "../libs/HttpDB";
// ============================================
//  缓存读写辅助（委托至 Storage）
// ============================================
import { Storage } from "../libs/Storage";
function getData(key, fallback) {
    return Storage.get(key, fallback);
}
function setData(key, value) {
    Storage.set(key, value);
}
/** 格式化时间戳为YYYY-MM-DD HH:mm */
export function formatTimestamp(ts) {
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
// ============================================
//  DogeChat 核心类
// ============================================
export class DogeChat {
    /** 生成唯一ID */
    static generateId() {
        return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    }
    // ---------- 保留期 ----------
    /** 获取频道消息保留期（毫秒） */
    static getRetention(channel) {
        if (channel.config.isBroadcast)
            return Infinity;
        switch (channel.type) {
            case "private": return 30 * 24 * 60 * 60 * 1000; // 30 天
            case "system": return 24 * 60 * 60 * 1000; // 1 天
            case "public":
            case "custom":
            default: return 7 * 24 * 60 * 60 * 1000; // 7 天
        }
    }
    // ============================================
    //  频道管理
    // ============================================
    /** 初始化默认频道 */
    static initChannels() {
        const channels = getData(this.KEY_CHANNELS, []);
        if (channels.length > 0)
            return;
        channels.push({
            id: this.generateId(),
            name: "公共频道",
            type: "public",
            prefix: "PB",
            createdAt: Date.now(),
            config: Object.assign({}, this.DEFAULT_CHANNEL_CONFIG),
        });
        channels.push({
            id: this.generateId(),
            name: "公告",
            type: "custom",
            prefix: "BC",
            createdAt: Date.now(),
            config: Object.assign(Object.assign({}, this.DEFAULT_CHANNEL_CONFIG), { isBroadcast: true }),
        });
        setData(this.KEY_CHANNELS, channels);
    }
    /** 获取所有频道 */
    static getChannels() {
        return getData(this.KEY_CHANNELS, []);
    }
    /** 获取指定频道 */
    static getChannel(id) {
        return this.getChannels().find(c => c.id === id);
    }
    /** 获取公共频道 */
    static getPublicChannel() {
        const channels = this.getChannels();
        let pub = channels.find(c => c.type === "public");
        if (!pub) {
            this.initChannels();
            pub = this.getChannels().find(c => c.type === "public");
        }
        return pub;
    }
    /** 创建新频道
     @param name 频道名称
     @param prefix 频道前缀
     @param type 频道类型
     @param config 频道配置
     @param owner 频道所有者
     @returns 频道ID */
    static createChannel(name, prefix, type, config, owner) {
        const channels = this.getChannels();
        if (channels.some(c => c.name === name))
            return ""; // 名称查重
        const channel = {
            id: this.generateId(),
            name, prefix,
            type: type,
            ownerid: owner === null || owner === void 0 ? void 0 : owner.id,
            createdAt: Date.now(),
            config: Object.assign(Object.assign({}, this.DEFAULT_CHANNEL_CONFIG), config),
        };
        channels.push(channel);
        setData(this.KEY_CHANNELS, channels);
        return channel.id;
    }
    /** 删除指定频道
     @param channelId 频道ID
     @returns 是否删除成功 */
    static deleteChannel(channelId) {
        const channels = this.getChannels();
        const idx = channels.findIndex(c => c.id === channelId);
        if (idx === -1)
            return false; // 频道不存在
        if (channels[idx].type === "public")
            return false; // 公共频道不能删除
        channels.splice(idx, 1);
        setData(this.KEY_CHANNELS, channels);
        // 清理 Dynamic Property 中的历史
        const history = getData(this.KEY_CHANNEL_HISTORY, {});
        delete history[channelId];
        setData(this.KEY_CHANNEL_HISTORY, history);
        // 清理 HttpDB 中的历史
        HttpDB.deleteChannelMessages(channelId).catch(() => { });
        return true;
    }
    /** 更新指定频道配置
     @param channelId 频道ID
     @param config 频道配置
     @returns 是否更新成功 */
    static updateChannelConfig(channelId, config) {
        const channels = this.getChannels();
        const channel = channels.find(c => c.id === channelId);
        if (!channel)
            return false; // 频道不存在
        channel.config = Object.assign(Object.assign({}, channel.config), config);
        setData(this.KEY_CHANNELS, channels);
        return true;
    }
    /** 更新指定频道名称
     @param channelId 频道ID
     @param newName 新名称
     @param newPrefix 新前缀
     @returns 是否更新成功 */
    static updateChannelName(channelId, newName, newPrefix) {
        const channels = this.getChannels();
        const channel = channels.find(c => c.id === channelId);
        if (!channel)
            return false; // 频道不存在
        channel.name = newName;
        channel.prefix = newPrefix;
        setData(this.KEY_CHANNELS, channels);
        return true;
    }
    // ============================================
    //  玩家活跃频道
    // ============================================
    /** 获取所有玩家的活跃频道设置
    @param player 玩家
    @returns 所有玩家的活跃频道设置 */
    static getPlayerSettings(player) {
        const all = getData(this.KEY_PLAYER_SETTINGS, {});
        if (!all[player.id]) {
            const pub = this.getPublicChannel();
            all[player.id] = { id: player.id, activeChannel: pub.id };
            setData(this.KEY_PLAYER_SETTINGS, all);
        }
        return all[player.id];
    }
    /** 获取玩家的活跃频道
    @param player 玩家
    @returns 玩家的活跃频道 */
    static getActiveChannel(player) {
        const settings = this.getPlayerSettings(player);
        const channel = this.getChannel(settings.activeChannel);
        if (channel)
            return channel;
        const pub = this.getPublicChannel();
        settings.activeChannel = pub.id;
        const all = getData(this.KEY_PLAYER_SETTINGS, {});
        all[player.id] = settings;
        setData(this.KEY_PLAYER_SETTINGS, all);
        return pub;
    }
    /** 设置玩家的活跃频道
    @param player 玩家
    @param channelId 频道ID
    @returns 是否设置成功 */
    static setActiveChannel(player, channelId) {
        const all = getData(this.KEY_PLAYER_SETTINGS, {});
        const settings = all[player.id];
        if (!settings)
            return false;
        settings.activeChannel = channelId;
        setData(this.KEY_PLAYER_SETTINGS, all);
        return true;
    }
    /** 频道在线人数（活跃频道为该频道的在线玩家数）
     * @param channelId 频道ID
     * @returns 频道在线人数 */
    static getOnlineCount(channelId) {
        var _a;
        const all = getData(this.KEY_PLAYER_SETTINGS, {});
        let count = 0;
        for (const p of world.getPlayers()) {
            if (((_a = all[p.id]) === null || _a === void 0 ? void 0 : _a.activeChannel) === channelId)
                count++;
        }
        return count;
    }
    /** 获取玩家的私聊频道
    @param player 玩家
    @returns 玩家的私聊频道列表 */
    static getPrivateChannels(player) {
        return this.getChannels().filter(c => c.type === "private" && c.id.includes(player.id));
    }
    // ============================================
    //  系统消息频道
    // ============================================
    /** 获取玩家的系统消息频道ID 每个玩家单独分配
    @param player 玩家
    @returns 玩家的系统消息频道ID */
    static getSystemChannelId(player) {
        return `sys_${player.id}`;
    }
    /** 确保玩家的系统消息频道存在
    @param player 玩家
    @returns 玩家的系统消息频道 */
    static ensureSystemChannel(player) {
        const channelId = this.getSystemChannelId(player);
        const existing = this.getChannel(channelId);
        if (existing)
            return existing;
        const channels = getData(this.KEY_CHANNELS, []);
        const channel = {
            id: channelId,
            name: "系统消息",
            type: "system",
            prefix: "SYS",
            ownerid: player.id,
            createdAt: Date.now(),
            config: Object.assign(Object.assign({}, this.DEFAULT_CHANNEL_CONFIG), { allowChat: false }),
        };
        channels.push(channel);
        setData(this.KEY_CHANNELS, channels);
        return channel;
    }
    /** 发送系统消息到玩家的系统频道
    @param player 玩家
    @param content 系统消息内容 */
    static sendSystemMessage(player, content) {
        const channel = this.ensureSystemChannel(player);
        const msg = {
            id: this.generateId(),
            fromid: "system",
            fromName: "SYS",
            channelId: channel.id,
            type: "text",
            content,
            timestamp: Date.now(),
            showTimestamp: true,
        };
        this.addToHistory(channel.id, msg);
        /* // 如果玩家当前在系统频道，直接显示
        const settings = this.getPlayerSettings(player);
        if (settings.activeChannel === channel.id) {
          player.sendMessage(`§7${formatTimestamp(msg.timestamp)}`);
          player.sendMessage(`§9[系统] ${content}`);
        } */
    }
    /** 判断是否为私聊频道的参与者
    @param channelId 频道ID
    @param playerId 玩家ID
    @returns 是否为私聊频道的参与者 */
    static isPrivateParticipant(channelId, playerId) {
        if (!channelId.startsWith("priv_"))
            return false;
        return channelId.includes(playerId);
    }
    /** 获取私聊频道中的另一方 id
    @param channelId 频道ID
    @param myId 玩家ID
    @returns 另一方 id 如果是私聊频道的参与者 */
    static getPrivateOther(channelId, myId) {
        if (!channelId.startsWith("priv_"))
            return undefined;
        const parts = channelId.split("_");
        return parts[1] === myId ? parts[2] : parts[1];
    }
    /** 循环切换频道（跳过私聊）
    @param player 玩家
    @returns 切换后的频道 */
    static cycleChannel(player) {
        const all = this.getChannels();
        const switchable = all.filter(c => c.type !== "private");
        if (switchable.length === 0) {
            const pub = this.getPublicChannel();
            this.setActiveChannel(player, pub.id);
            return pub;
        }
        const current = this.getActiveChannel(player);
        const idx = switchable.findIndex(c => c.id === current.id);
        const next = switchable[(idx + 1) % switchable.length];
        this.setActiveChannel(player, next.id);
        return next;
    }
    // ============================================
    //  消息同步
    // ============================================
    /** 获取频道的历史消息（优先 HttpDB，回退到 Dynamic Property） */
    static getChannelHistory(channelId) {
        return __awaiter(this, void 0, void 0, function* () {
            const channel = this.getChannel(channelId);
            if (!channel)
                return [];
            const cutoff = Date.now() - this.getRetention(channel);
            // 尝试从 HttpDB 获取，失败则回退到 Dynamic Property
            const rows = yield HttpDB.loadHistory(channelId, cutoff);
            if (rows !== null)
                return rows;
            // 回退
            const history = getData(this.KEY_CHANNEL_HISTORY, {});
            const msgs = history[channelId] || [];
            return msgs.filter(m => m.timestamp >= cutoff);
        });
    }
    /** 添加至频道历史消息记录 */
    static addToHistory(channelId, msg) {
        const channel = this.getChannel(channelId);
        if (!channel)
            return;
        // 始终写入 Dynamic Property（同步回退）
        const history = getData(this.KEY_CHANNEL_HISTORY, {});
        if (!history[channelId])
            history[channelId] = [];
        history[channelId].push(msg);
        const cutoff = Date.now() - this.getRetention(channel);
        history[channelId] = history[channelId].filter(m => m.timestamp >= cutoff);
        setData(this.KEY_CHANNEL_HISTORY, history);
        // 异步写入 HttpDB（连接可用时）
        HttpDB.saveMessage(channelId, {
            id: msg.id,
            fromid: msg.fromid,
            fromName: msg.fromName,
            type: msg.type,
            content: msg.content,
            attachment: msg.attachment,
            showTimestamp: !!msg.showTimestamp,
            timestamp: msg.timestamp,
        }).catch((err) => console.warn(`[DogeChat] 保存消息失败: ${err}`));
    }
    /** 切换频道时加载历史消息 */
    static loadChannelHistory(player, channelId) {
        return __awaiter(this, void 0, void 0, function* () {
            const channel = this.getChannel(channelId);
            if (!channel)
                return;
            const history = yield this.getChannelHistory(channelId);
            if (history.length === 0) {
                player.sendMessage(`§7--- §f${channel.prefix} §7频道暂无历史消息 ---`);
                return;
            }
            player.sendMessage(`§7--- §f${channel.prefix} §7频道历史消息 ---`);
            for (const msg of history) {
                if (msg.showTimestamp) {
                    player.sendMessage(`§7${formatTimestamp(msg.timestamp)}`);
                }
                let display = msg.content;
                switch (msg.type) {
                    case "location":
                        display = `§a[定位] ${display}`;
                        break;
                    case "teleport_invite":
                        display = `§e[传送邀请] ${display}`;
                        break;
                    case "redpacket":
                        display = `§6[红包] ${display}`;
                        break;
                }
                player.sendMessage({ rawtext: [{ text: `§b[${channel.prefix}] §f${msg.fromName}: ${display}` }] });
            }
            player.sendMessage(`§7--- 以上为历史消息，共 ${history.length} 条 ---`);
            player.sendMessage("§7!lo §8发送定位 §7| !tp §8传送邀请 §7| !hb §8发送红包");
        });
    }
    // ============================================
    //  发送消息
    // ============================================
    static sendChannelMessage(from_1, channelId_1, content_1) {
        return __awaiter(this, arguments, void 0, function* (from, channelId, content, type = "text", attachment) {
            var _a, _b;
            const channel = this.getChannel(channelId);
            if (!channel)
                return false;
            if (!channel.config.allowChat) {
                if (channel.type === "system")
                    Msg.warning("该频道只读。", from);
                return false;
            }
            // 公告板模式
            if (channel.config.isBroadcast) {
                if (!this.isChannelOwner(from, channelId)) {
                    Msg.warning("此频道为公告板模式，只有管理员才能发言。", from);
                    return false;
                }
                const msg = {
                    id: this.generateId(),
                    fromid: from.id, fromName: from.name,
                    channelId, type, content, attachment,
                    timestamp: Date.now(),
                    showTimestamp: true, // 公告板每条消息都显示时间
                };
                this.addToHistory(channelId, msg);
                // 推送给所有在线玩家（同时显示时间戳）
                const prefix = `§a[${channel.prefix}公告]`;
                for (const p of world.getPlayers()) {
                    if (p.id === from.id)
                        continue;
                    p.sendMessage(`§7${formatTimestamp(msg.timestamp)}`);
                    p.sendMessage({ rawtext: [{ text: `${prefix} ${from.name}: ${content}` }] });
                }
                return true;
            }
            // slowMode
            if (channel.config.slowMode > 0) {
                const playerMap = this.slowModeTracker.get(from.id);
                const lastTs = (_a = playerMap === null || playerMap === void 0 ? void 0 : playerMap.get(channelId)) !== null && _a !== void 0 ? _a : 0;
                const elapsed = (Date.now() - lastTs) / 1000;
                if (elapsed < channel.config.slowMode) {
                    Msg.warning(`频道 ${channel.prefix} 慢速模式中，请等待 ${Math.ceil(channel.config.slowMode - elapsed)} 秒。`, from);
                    return false;
                }
            }
            // 计算 showTimestamp（距离上条消息超过 5 分钟）
            const history = yield this.getChannelHistory(channelId);
            const lastMsg = history.length > 0 ? history[history.length - 1] : undefined;
            const showTimestamp = !lastMsg || (Date.now() - lastMsg.timestamp) > 5 * 60 * 1000;
            const msg = {
                id: this.generateId(),
                fromid: from.id, fromName: from.name,
                channelId, type, content, attachment,
                timestamp: Date.now(),
                showTimestamp,
            };
            this.addToHistory(channelId, msg);
            // 回显给发送者
            if (showTimestamp)
                from.sendMessage(`§7${formatTimestamp(msg.timestamp)}`);
            from.sendMessage({ rawtext: [{ text: `§b[${channel.prefix}] §f${from.name}: ${content}` }] });
            // 推送给其他活跃频道匹配的在线玩家
            const all = getData(this.KEY_PLAYER_SETTINGS, {});
            for (const p of world.getPlayers()) {
                if (p.id === from.id)
                    continue;
                if (((_b = all[p.id]) === null || _b === void 0 ? void 0 : _b.activeChannel) !== channelId)
                    continue;
                let display = content;
                switch (type) {
                    case "location":
                        display = `§a[定位] ${display}`;
                        break;
                    case "teleport_invite":
                        display = `§e[传送邀请] ${display}`;
                        break;
                    case "redpacket":
                        display = `§6[红包] ${display}`;
                        break;
                }
                if (showTimestamp)
                    p.sendMessage(`§7${formatTimestamp(msg.timestamp)}`);
                p.sendMessage({ rawtext: [{ text: `§b[${channel.prefix}] §f${from.name}: ${display}` }] });
            }
            if (channel.config.slowMode > 0) {
                if (!this.slowModeTracker.has(from.id))
                    this.slowModeTracker.set(from.id, new Map());
                this.slowModeTracker.get(from.id).set(channelId, Date.now());
            }
            return true;
        });
    }
    /** 发送私聊 */
    static sendPrivateMessage(from_1, toPlayer_1, content_1) {
        return __awaiter(this, arguments, void 0, function* (from, toPlayer, content, type = "text") {
            var _a;
            const channel = this.ensurePrivateChannel(from.id, toPlayer.id);
            const history = yield this.getChannelHistory(channel.id);
            const lastMsg = history.length > 0 ? history[history.length - 1] : undefined;
            const showTimestamp = !lastMsg || (Date.now() - lastMsg.timestamp) > 5 * 60 * 1000;
            const msg = {
                id: this.generateId(),
                fromid: from.id, fromName: from.name,
                channelId: channel.id, type, content,
                timestamp: Date.now(),
                showTimestamp,
            };
            this.addToHistory(channel.id, msg);
            // 推送给活跃频道匹配的玩家
            const all = getData(this.KEY_PLAYER_SETTINGS, {});
            for (const p of [from, toPlayer]) {
                if (((_a = all[p.id]) === null || _a === void 0 ? void 0 : _a.activeChannel) === channel.id) {
                    let display = content;
                    switch (type) {
                        case "location":
                            display = `§a[定位] ${display}`;
                            break;
                        case "teleport_invite":
                            display = `§e[传送邀请] ${display}`;
                            break;
                        case "redpacket":
                            display = `§6[红包] ${display}`;
                            break;
                    }
                    if (showTimestamp)
                        p.sendMessage(`§7${formatTimestamp(msg.timestamp)}`);
                    const sender = p.id === from.id ? toPlayer.name : from.name;
                    p.sendMessage({ rawtext: [{ text: `§d[私信] §f${sender}: ${display}` }] });
                }
                else if (p.id !== from.id) {
                    Msg.info(`§b${from.name} 发来一条私信。使用 !channel 切换到私聊频道查看。`, p);
                }
            }
            return true;
        });
    }
    /** 创建或获取私聊频道 */
    static ensurePrivateChannel(idA, idB) {
        var _a, _b;
        const ids = [idA, idB].sort();
        const channelId = `priv_${ids[0]}_${ids[1]}`;
        let channel = this.getChannel(channelId);
        if (channel)
            return channel;
        const nameB = (_b = (_a = world.getPlayers().find(p => p.id === idB)) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : idB;
        const channels = getData(this.KEY_CHANNELS, []);
        channel = {
            id: channelId,
            name: `与 ${nameB} 的私聊`,
            type: "private",
            prefix: `私聊-${nameB}`,
            ownerid: idA,
            createdAt: Date.now(),
            config: Object.assign({}, this.DEFAULT_CHANNEL_CONFIG),
        };
        channels.push(channel);
        setData(this.KEY_CHANNELS, channels);
        return channel;
    }
    // ============================================
    //  定位 & 传送
    // ============================================
    static createLocationMessage(player) {
        const loc = player.location;
        return `${player.dimension.id}:${Math.floor(loc.x)},${Math.floor(loc.y)},${Math.floor(loc.z)}`;
    }
    static sendTeleportInvite(from, toPlayer) {
        const loc = from.location;
        const locStr = `${from.dimension.id}:${Math.floor(loc.x)},${Math.floor(loc.y)},${Math.floor(loc.z)}`;
        return this.sendPrivateMessage(from, toPlayer, `${from.name} 邀请你传送到他的位置！(${locStr})`, "teleport_invite");
    }
    // ============================================
    //  红包
    // ============================================
    static sendRedPacket(sender, amount, count, targetType, targetId) {
        if (amount <= 0 || count <= 0 || count > amount) {
            Msg.error("红包参数无效。", sender);
            return false;
        }
        const balance = Money.get(sender);
        if (balance < amount) {
            Msg.error(`${Money.UNIT}不足，需要 ${amount}，当前 ${balance}。`, sender);
            return false;
        }
        Money.set(sender, balance - amount);
        const packet = {
            id: this.generateId(),
            senderid: sender.id, senderName: sender.name,
            totalAmount: amount, remainingAmount: amount,
            totalCount: count, remainingCount: count,
            receivers: [],
            targetType, targetId,
            createdAt: Date.now(),
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        };
        const packets = getData(this.KEY_REDPACKETS, []);
        packets.push(packet);
        setData(this.KEY_REDPACKETS, packets);
        Msg.success(`${sender.name} 发送了红包：${amount} ${Money.UNIT}（共 ${count} 份）。`, sender);
        if (targetType === "group" && this.getChannel(targetId)) {
            this.addToHistory(targetId, {
                id: this.generateId(),
                fromid: sender.id, fromName: sender.name,
                channelId: targetId, type: "redpacket",
                content: `发送了 ${amount} ${Money.UNIT} 的红包（共 ${count} 份）`,
                timestamp: Date.now(),
            });
        }
        return true;
    }
    static claimRedPacket(player, packetId) {
        const packets = getData(this.KEY_REDPACKETS, []);
        const packet = packets.find(p => p.id === packetId);
        if (!packet) {
            Msg.error("红包不存在。", player);
            return 0;
        }
        if (packet.remainingCount <= 0) {
            Msg.error("红包已被领完。", player);
            return 0;
        }
        if (packet.receivers.includes(player.id)) {
            Msg.warning("你已经领取过这个红包了。", player);
            return 0;
        }
        if (Date.now() > packet.expiresAt) {
            Msg.error("红包已过期。", player);
            return 0;
        }
        let amount;
        if (packet.remainingCount === 1) {
            amount = packet.remainingAmount;
        }
        else {
            const max = Math.floor((packet.remainingAmount / packet.remainingCount) * 2);
            amount = Math.max(1, Math.floor(Math.random() * (max + 1)));
            amount = Math.min(amount, packet.remainingAmount - (packet.remainingCount - 1));
        }
        packet.remainingAmount -= amount;
        packet.remainingCount--;
        packet.receivers.push(player.id);
        setData(this.KEY_REDPACKETS, packets);
        Money.add(player, amount);
        Msg.success(`你领取了 ${packet.senderName} 的红包，获得 ${amount} ${Money.UNIT}！`, player);
        return amount;
    }
    static getAvailableRedPackets(player) {
        const packets = getData(this.KEY_REDPACKETS, []);
        const now = Date.now();
        return packets.filter(p => {
            if (p.remainingCount <= 0 || now > p.expiresAt)
                return false;
            if (p.receivers.includes(player.id))
                return false;
            if (p.targetType === "player")
                return p.targetId === player.id;
            return true; // group → 任何玩家都可领
        });
    }
    static cleanupExpiredRedPackets() {
        const packets = getData(this.KEY_REDPACKETS, []);
        const valid = packets.filter(p => Date.now() <= p.expiresAt);
        if (valid.length < packets.length)
            setData(this.KEY_REDPACKETS, valid);
    }
    // ============================================
    //  权限判断
    // ============================================
    static isChannelOwner(player, channelId) {
        var _a;
        return ((_a = this.getChannel(channelId)) === null || _a === void 0 ? void 0 : _a.ownerid) === player.id;
    }
}
DogeChat.KEY_CHANNELS = "chat:channels";
DogeChat.KEY_PLAYER_SETTINGS = "chat:player_settings";
DogeChat.KEY_CHANNEL_HISTORY = "chat:channel_history";
DogeChat.KEY_REDPACKETS = "chat:redpackets";
DogeChat.slowModeTracker = new Map();
DogeChat.DEFAULT_CHANNEL_CONFIG = {
    allowChat: true,
    slowMode: 0,
    isBroadcast: false,
};
//# sourceMappingURL=DogeChat.js.map