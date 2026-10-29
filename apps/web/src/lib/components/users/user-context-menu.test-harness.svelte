<script lang="ts">
	import { untrack } from 'svelte';
	// Only used by `user-context-menu.svelte.spec.ts`: sets the context the channels layout sets.
	import type { UserAudioControls } from '#lib/call.svelte.ts';
	import UserContextMenu from '#lib/components/users/user-context-menu.svelte';
	import type { ModerationAction } from '#lib/moderation.ts';
	import { setUserMenuContext, type MenuUser, type UserMenuAccess } from '#lib/user-menu.ts';

	let {
		access,
		user,
		onmoderate,
		onmention,
		voice,
		audio
	}: {
		access?: UserMenuAccess;
		user: MenuUser;
		onmoderate?: (action: ModerationAction, user: MenuUser) => void;
		onmention?: () => void;
		voice?: boolean;
		audio?: UserAudioControls;
	} = $props();

	// Without access the menu behaves as outside a server.
	if (untrack(() => access)) {
		setUserMenuContext({
			get access() {
				return access!;
			},
			moderate: (action, target) => onmoderate?.(action, target)
		});
	}
</script>

<ul aria-label="People">
	<UserContextMenu {user} {onmention} {voice} {audio}>
		{#snippet child({ props })}
			<li {...props}>{user.name}</li>
		{/snippet}
	</UserContextMenu>
</ul>
