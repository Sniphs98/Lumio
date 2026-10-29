<script lang="ts">
	import { untrack } from 'svelte';
	// Only used by `user-context-menu.svelte.spec.ts`: sets the context the channels layout sets.
	import UserContextMenu from '#lib/components/users/user-context-menu.svelte';
	import type { ModerationAction } from '#lib/moderation.ts';
	import { setUserMenuContext, type MenuUser, type UserMenuAccess } from '#lib/user-menu.ts';

	let {
		access,
		user,
		onmoderate,
		onmention
	}: {
		access?: UserMenuAccess;
		user: MenuUser;
		onmoderate?: (action: ModerationAction, user: MenuUser) => void;
		onmention?: () => void;
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
	<UserContextMenu {user} {onmention}>
		{#snippet child({ props })}
			<li {...props}>{user.name}</li>
		{/snippet}
	</UserContextMenu>
</ul>
