import { redirect } from '@sveltejs/kit';
import { hasPermission, Permission } from '#lib/permissions.ts';
import { getServerPermissions, listChannels, listVisibleChannelIds } from '#lib/server/channels.ts';
import { getVoiceState } from '#lib/server/voice.ts';
import { visibleVoiceState } from '#lib/server/voice-state.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
	const [channels, permissions, voiceChannelIds, voice] = await Promise.all([
		listChannels(),
		getServerPermissions(locals.user.id),
		listVisibleChannelIds(locals.user.id, 'voice'),
		getVoiceState()
	]);
	return {
		channels,
		/** Who is in which voice channel. The layout keeps it live over `/api/voice/events`. */
		voice: visibleVoiceState(voice, voiceChannelIds),
		canInvite: hasPermission(permissions, Permission.CreateInvite),
		canManageServer: hasPermission(permissions, Permission.ManageServer)
	};
};
