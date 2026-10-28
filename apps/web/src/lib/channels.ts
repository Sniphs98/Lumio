export type ChannelType = 'category' | 'text' | 'voice';

/** Channel types with a chat: messages, reactions, replies, mentions, files and unread counts. */
export const CHAT_CHANNEL_TYPES = ['text', 'voice'] as const satisfies ChannelType[];
export type ChatChannelType = (typeof CHAT_CHANNEL_TYPES)[number];

/**
 * Text and voice channels behave the same as chats. Categories only group channels.
 */
export function hasChat(type: ChannelType): type is ChatChannelType {
	return (CHAT_CHANNEL_TYPES as readonly ChannelType[]).includes(type);
}

/** On top of their chat, voice channels can be joined to talk, stream and share the screen. */
export function isJoinable(type: ChannelType): type is 'voice' {
	return type === 'voice';
}
