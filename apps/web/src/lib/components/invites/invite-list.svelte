<script lang="ts">
	import { enhance } from '$app/forms';
	import { Trash2 } from '@lucide/svelte';
	import { Button } from '#lib/components/ui/button/index.ts';
	import * as Item from '#lib/components/ui/item/index.ts';
	import { describeExpiry, describeUses } from '#lib/invites.ts';
	import CopyButton from './copy-button.svelte';

	type Invite = {
		code: string;
		url: string;
		createdByName: string;
		uses: number;
		maxUses: number | null;
		expiresAt: Date | null;
		/** Whether people can join as a guest. Defaults to true. */
		allowGuests?: boolean;
		canRevoke: boolean;
	};

	let { invites, showCreator }: { invites: Invite[]; showCreator: boolean } = $props();

	const details = (invite: Invite) =>
		[
			showCreator ? invite.createdByName : null,
			describeUses(invite.uses, invite.maxUses),
			describeExpiry(invite.expiresAt),
			invite.allowGuests === false ? 'Accounts only' : null
		]
			.filter(Boolean)
			.join(' · ');
</script>

{#if invites.length === 0}
	<p class="text-sm text-muted-foreground">No active invite links.</p>
{:else}
	<Item.Group class="gap-2">
		{#each invites as invite (invite.code)}
			<Item.Root variant="outline" size="sm" class="flex-nowrap py-2 pr-2" role="listitem">
				<Item.Content class="min-w-0">
					<Item.Title class="line-clamp-none block w-full truncate font-mono font-normal"
						>{invite.url}</Item.Title
					>
					<Item.Description class="line-clamp-1 text-xs">{details(invite)}</Item.Description>
				</Item.Content>
				<Item.Actions class="gap-0">
					<CopyButton text={invite.url} label="Copy invite link {invite.code}" />
					{#if invite.canRevoke}
						<form method="post" action="?/revoke" use:enhance>
							<input type="hidden" name="code" value={invite.code} />
							<Button
								type="submit"
								size="icon"
								variant="ghost"
								class="size-8 text-destructive hover:text-destructive"
								aria-label="Revoke invite link {invite.code}"
							>
								<Trash2 />
							</Button>
						</form>
					{/if}
				</Item.Actions>
			</Item.Root>
		{/each}
	</Item.Group>
{/if}
