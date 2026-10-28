import { allowedSources, type CallKind, type CallSource } from '#lib/calls.ts';
import { isJoinable } from '#lib/channels.ts';
import { hasPermission, Permission } from '#lib/permissions.ts';
import { getChannel, getChannelPermissions } from '#lib/server/channels.ts';
import { getConversation, type ConversationDetails } from '#lib/server/conversations.ts';
import { areFriends } from '#lib/server/friends.ts';

export type CallAccess = {
	sources: CallSource[];
	/** Set for conversation calls, so the other members can be rung. */
	conversation?: ConversationDetails;
};

/**
 * Checks whether a user may join the call of a voice channel or conversation.
 * Returns what they may publish there, or null if they may not join.
 */
export async function getCallAccess(
	userId: string,
	target: { kind: CallKind; id: string }
): Promise<CallAccess | null> {
	if (target.kind === 'channel') {
		const channel = await getChannel(target.id).catch(() => null);
		if (!channel || !isJoinable(channel.type)) return null;
		const permissions = await getChannelPermissions(userId, channel.id);
		if (
			!hasPermission(permissions, Permission.ViewChannel) ||
			!hasPermission(permissions, Permission.Connect)
		) {
			return null;
		}
		return { sources: allowedSources(permissions) };
	}

	const conversation = await getConversation(target.id, userId);
	if (!conversation) return null;
	// Same rule as for messages: direct calls need an accepted friendship.
	if (conversation.type === 'direct') {
		const other = conversation.others[0];
		if (!other || conversation.others.length !== 1 || !(await areFriends(userId, other.id))) {
			return null;
		}
	}
	return {
		sources: ['microphone', 'camera', 'screen_share', 'screen_share_audio'],
		conversation
	};
}
