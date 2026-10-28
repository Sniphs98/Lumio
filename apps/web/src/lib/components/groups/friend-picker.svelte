<script lang="ts">
	import { Checkbox } from '#lib/components/ui/checkbox/index.ts';
	import type { FriendUser } from '#lib/friends.ts';
	import UserAvatar from './user-avatar.svelte';

	type Props = {
		friends: FriendUser[];
		/** Accessible name of the list, e.g. "Friends to add". */
		label: string;
		/** Form field the picked user ids are sent as. */
		name?: string;
	};

	let { friends, label, name = 'userId' }: Props = $props();
</script>

<ul class="grid gap-0.5" aria-label={label}>
	{#each friends as friend (friend.id)}
		<li>
			<label
				class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted"
			>
				<Checkbox {name} value={friend.id} aria-label={friend.name} />
				<UserAvatar user={friend} />
				<span class="min-w-0 flex-1 truncate">{friend.name}</span>
			</label>
		</li>
	{/each}
</ul>
