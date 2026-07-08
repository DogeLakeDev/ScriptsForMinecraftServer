export type MessageType = "text" | "location" | "redpacket" | "teleport_invite" | "attachment";

export interface ChannelConfig {
  allowChat: boolean;
  slowMode: number;
  isBroadcast: boolean;
}

export interface Channel {
  id: string;
  name: string;
  type: "public" | "private" | "custom" | "system";
  prefix: string;
  ownerid?: string;
  createdAt: number;
  config: ChannelConfig;
}

export interface ChatMessage {
  id: string;
  fromid: string;
  fromName: string;
  channelId: string;
  type: MessageType;
  content: string;
  attachment?: string;
  timestamp: number;
  showTimestamp?: boolean;
}

export interface RedPacket {
  id: string;
  senderid: string;
  senderName: string;
  totalAmount: number;
  remainingAmount: number;
  totalCount: number;
  remainingCount: number;
  receivers: string[];
  targetType: "player" | "group";
  targetId: string;
  createdAt: number;
  expiresAt: number;
}

export interface PlayerChannelSettings {
  id: string;
  activeChannel: string;
}
