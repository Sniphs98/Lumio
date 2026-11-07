<script lang="ts">
	import type { ChatUser } from '#lib/chat.ts';
	import UserAvatar from '#lib/components/groups/user-avatar.svelte';
	import * as Command from '#lib/components/ui/command/index.ts';

	type Props = {
		id: string;
		users: ChatUser[];
		/** Index of the highlighted suggestion; Enter or Tab picks it. */
		active: number;
		/** Hovering a suggestion highlights it, like the arrow keys in the composer do. */
		onactive?: (index: number) => void;
		onpick: (user: ChatUser) => void;
	};

	let { id, users, active, onactive, onpick }: Props = $props();
</script>

<!--
	The composer keeps the focus and handles the keys, so there is no Command.Input: the list
	only shows the suggestions and which one is highlighted.
-->
<Command.Root
	shouldFilter={false}
	value={users[active]?.id ?? ''}
	onValueChange={(value) => {
		const index = users.findIndex((u) => u.id === value);
		if (index !== -1 && index !== active) onactive?.(index);
	}}
	class="mb-2 h-auto rounded-lg border shadow-md"
>
	<Command.List {id} aria-label="Mention someone" class="max-h-64 p-1">
		{#each users as user (user.id)}
			<Command.Item
				value={user.id}
				onSelect={() => onpick(user)}
				onpointerdown={(e: PointerEvent) => {
					// Keep the focus in the composer.
					e.preventDefault();
				}}
			>
				<UserAvatar {user} class="size-5" fallbackClass="text-[0.625rem] font-semibold" />
				<span class="truncate">{user.name}</span>
			</Command.Item>
		{/each}
	</Command.List>
</Command.Root>
