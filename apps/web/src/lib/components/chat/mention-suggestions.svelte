<script lang="ts">
	import type { ChatUser } from '#lib/chat.ts';
	import UserAvatar from '#lib/components/groups/user-avatar.svelte';
	import { cn } from '#lib/utils.ts';

	type Props = {
		id: string;
		users: ChatUser[];
		/** Index of the highlighted suggestion; Enter or Tab picks it. */
		active: number;
		onpick: (user: ChatUser) => void;
	};

	let { id, users, active, onpick }: Props = $props();
</script>

<ul
	{id}
	role="listbox"
	aria-label="Mention someone"
	class="mb-2 grid max-h-64 gap-0.5 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
>
	{#each users as user, i (user.id)}
		<li
			id="{id}-{i}"
			role="option"
			aria-selected={i === active}
			class={cn(
				'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm',
				i === active ? 'bg-muted' : 'hover:bg-muted/60'
			)}
			onpointerdown={(e) => {
				// Keep the focus in the composer.
				e.preventDefault();
				onpick(user);
			}}
		>
			<UserAvatar {user} class="size-5" fallbackClass="text-[0.625rem] font-semibold" />
			<span class="truncate">{user.name}</span>
		</li>
	{/each}
</ul>
