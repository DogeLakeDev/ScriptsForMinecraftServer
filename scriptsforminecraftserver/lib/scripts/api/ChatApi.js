import { HttpDB } from "../libs/HttpDB";
import { toQueryString } from "../libs/Tools";
const PATH_CHANNELS = "/api/sfmc/channels";
const PATH_MESSAGES = "/api/sfmc/messages";
const PATH_REDPACKET = "/api/sfmc/redpacket";
/**
 * 模糊搜索频道
 * @param filter 搜索参数
 * @returns 符合条件的频道列表
 */
export async function getChannels(filter) {
    const qs = toQueryString({
        search: filter?.search,
        type: filter?.type,
        ownerId: filter?.ownerId,
        minCreatedAt: filter?.minCreatedAt,
        maxCreatedAt: filter?.maxCreatedAt,
    });
    const path = `${PATH_CHANNELS}${qs}`;
    const body = await HttpDB.get(path);
    if (!body)
        return null;
    try {
        const raw = JSON.parse(body).channels;
        return raw.map(toChannel);
    }
    catch {
        return null;
    }
}
/** 将数据库中的扁平频道数据还原为 Channel */
function toChannel(r) {
    return {
        id: r.id,
        name: r.name,
        type: r.type,
        prefix: r.prefix,
        ownerid: r.owner_id || undefined,
        createdAt: r.created_at,
        config: {
            allowChat: !!r.config_allow_chat,
            slowMode: r.config_slow_mode || 0,
            isBroadcast: !!r.config_is_broadcast,
        },
    };
}
/** 将数据库中的扁平消息数据还原为 ChatMessage */
function toMessage(r) {
    return {
        id: r.id,
        fromid: r.from_id,
        fromName: r.from_name,
        channelId: r.channel_id,
        type: r.type || "text",
        content: r.content,
        attachment: r.attachment,
        showTimestamp: !!r.show_timestamp,
        timestamp: r.created_at,
    };
}
/** 将数据库中的扁平红包数据还原为 RedPacket */
function toRedPacket(r) {
    return {
        id: r.id,
        senderid: r.sender_id,
        senderName: r.sender_name,
        totalAmount: r.total_amount,
        remainingAmount: r.remaining_amount,
        totalCount: r.total_count,
        remainingCount: r.remaining_count,
        receivers: JSON.parse(r.receivers || "[]"),
        targetType: r.target_type,
        targetId: r.target_id,
        createdAt: r.created_at,
        expiresAt: r.expires_at,
    };
}
export async function getChannel(channelId) {
    const raw = await HttpDB.fetchJSON(PATH_CHANNELS, channelId, "channel");
    if (!raw)
        return null;
    return toChannel(raw);
}
/**
 * 创建单个频道
 * @param channel 频道对象
 * @returns 是否成功
 */
export async function createChannel(channel) {
    return saveChannels([channel]);
}
/**
 * 保存频道（批量）
 * @param channels 频道列表
 * @returns 是否成功
 */
export async function saveChannels(channels) {
    const flat = channels.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        prefix: c.prefix,
        ownerId: c.ownerid,
        createdAt: c.createdAt,
        configAllowChat: c.config?.allowChat,
        configSlowMode: c.config?.slowMode,
        configIsBroadcast: c.config?.isBroadcast,
    }));
    return HttpDB.post(PATH_CHANNELS, { channels: flat });
}
/**
 * 更新单个频道字段
 * @param channelId 频道id
 * @param data 要更新的字段
 * @returns 是否成功
 */
export async function patchChannel(channelId, data) {
    return HttpDB.patch(`${PATH_CHANNELS}/${encodeURIComponent(channelId)}`, data);
}
/**
 * 删除频道
 * @param channelId 频道id
 * @returns 是否成功
 */
export async function deleteChannel(channelId) {
    return HttpDB.del(`${PATH_CHANNELS}/${encodeURIComponent(channelId)}`);
}
/**
 * 模糊搜索聊天消息
 * @param filter 搜索参数
 * @returns 符合条件的聊天消息列表
 */
export async function getMessages(filter) {
    const qs = toQueryString({
        search: filter?.search,
        type: filter?.type,
        channelId: filter?.channelId,
        from: filter?.from,
        minSentAt: filter?.minSentAt,
        maxSentAt: filter?.maxSentAt,
    });
    const path = `${PATH_MESSAGES}${qs}`;
    const body = await HttpDB.get(path);
    if (!body)
        return null;
    try {
        const raw = JSON.parse(body).messages;
        return raw.map(toMessage);
    }
    catch {
        return null;
    }
}
/**
 * 保存聊天消息
 * @param messages 聊天消息列表
 * @returns 是否成功
 */
export async function saveMessages(messages) {
    return HttpDB.post(PATH_MESSAGES, { messages });
}
/**
 * 获取所有红包
 * @returns 红包列表
 */
export async function getRedPackets() {
    const body = await HttpDB.get(PATH_REDPACKET);
    if (!body)
        return [];
    try {
        const parsed = JSON.parse(body);
        const raw = parsed.redpackets || parsed.redpacket || [];
        return raw.map(toRedPacket);
    }
    catch {
        return [];
    }
}
/**
 * 按id精准匹配红包
 * @param redpacketId 红包id
 * @returns 红包对象
 */
export async function getRedPacket(redpacketId) {
    const raw = await HttpDB.fetchJSON(PATH_REDPACKET, redpacketId, "redpacket");
    if (!raw)
        return null;
    return toRedPacket(raw);
}
/**
 * 保存红包
 * @param redpacket 红包对象
 * @returns 是否成功
 */
export async function saveRedPacket(redpacket) {
    return HttpDB.post(PATH_REDPACKET, { redpacket });
}
/**
 * 更新红包
 * @param redpacketId 红包id
 * @param redpacketModify 红包修改字段
 * @returns 是否成功
 */
export async function updateRedPacket(redpacketId, redpacketModify) {
    return HttpDB.patch(`${PATH_REDPACKET}/${encodeURIComponent(redpacketId)}`, redpacketModify);
}
//# sourceMappingURL=ChatApi.js.map