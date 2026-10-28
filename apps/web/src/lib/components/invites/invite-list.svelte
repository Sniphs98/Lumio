<script lang="ts">
	import { enhance } from '$app/forms';
	import { Trash2 } from '@lucide/svelte';
	import { Button } from '#lib/components/ui/button/index.ts';
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
	<ul class="grid gap-2">
		{#each invites as invite (invite.code)}
			<li class="flex items-center gap-2 rounded-md border p-2 pl-3">
				<div class="min-w-0 flex-1">
					<p class="truncate font-mono text-sm">{invite.url}</p>
					<p class="truncate text-xs text-muted-foreground">{details(invite)}</p>
				</div>
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
			</li>
		{/each}
	</ul>
{/if}
