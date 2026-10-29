import { redirect } from '@sveltejs/kit';
import { isJoinable } from '#lib/channels.ts';
import { hasPermission, Permission } from '#lib/permissions.ts';
import { getServerPermissions, listChannels, listVisibleChannelIds } from '#lib/server/channels.ts';
import { getFriendLists } from '#lib/server/friends.ts';
import { listMembersFor } from '#lib/server/moderation.ts';
import { getVoiceState } from '#lib/server/voice.ts';
import { visibleVoiceState } from '#lib/server/voice-state.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
	const [channels, permissions, voiceChannelIds, voice, friendLists, members] = await Promise.all([
		listChannels(),
		getServerPermissions(locals.user.id),
		listVisibleChannelIds(locals.user.id, isJoinable),
		getVoiceState(),
		getFriendLists(locals.user.id),
		listMembersFor(locals.user.id)
	]);
	return {
		channels,
		/** Who is in which voice channel. The layout keeps it live over `/api/voice/events`. */
		voice: visibleVoiceState(voice, voiceChannelIds),
		canInvite: hasPermission(permissions, Permission.CreateInvite),
		canManageServer: hasPermission(permissions, Permission.ManageServer),
		/** What the right-click menu on a user offers. */
		userMenu: {
			friendIds: friendLists.friends.map((f) => f.id),
			members: members
				.filter((m) => m.canKick || m.canBan)
				.map((m) => ({ id: m.id, canKick: m.canKick, canBan: m.canBan, isGuest: m.isGuest }))
		}
	};
};
