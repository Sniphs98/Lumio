<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '#lib/components/ui/button/index.ts';
	import * as Card from '#lib/components/ui/card/index.ts';
	import * as Item from '#lib/components/ui/item/index.ts';
	import type { BannedUser } from './server-settings-dialog.svelte';
	import FormResult from './form-result.svelte';
	import { settingsForm } from './settings-form.svelte.ts';

	let { action, bans }: { action: string; bans: BannedUser[] } = $props();

	const unbanForm = settingsForm();
	const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
</script>

<Card.Root role="region" aria-labelledby="bans-heading" class="gap-4">
	<Card.Header>
		<Card.Title><h3 id="bans-heading">Banned</h3></Card.Title>
		<Card.Description>
			{bans.length === 0
				? 'Nobody is banned.'
				: 'Banned people cannot sign in until you lift the ban.'}
		</Card.Description>
	</Card.Header>
	{#if bans.length > 0}
		<Card.Content class="px-2 sm:px-4">
			<Item.Group class="gap-0">
				{#each bans as entry (entry.userId)}
					<Item.Root size="sm" class="flex-nowrap px-2 py-2" role="listitem">
						<Item.Content class="min-w-0">
							<Item.Title class="line-clamp-none block w-full truncate font-normal">
								{entry.name}
							</Item.Title>
							<Item.Description class="line-clamp-1 text-xs">
								{dateFormat.format(entry.createdAt)}{entry.reason ? ` · ${entry.reason}` : ''}
							</Item.Description>
						</Item.Content>
						<Item.Actions>
							<form method="post" action="{action}?/unban" use:enhance={unbanForm.submit}>
								<input type="hidden" name="userId" value={entry.userId} />
								<Button type="submit" variant="outline" size="sm">Unban</Button>
							</form>
						</Item.Actions>
					</Item.Root>
				{/each}
			</Item.Group>
		</Card.Content>
	{/if}
	{#if unbanForm.error || unbanForm.saved}
		<Card.Footer>
			<FormResult error={unbanForm.error} saved={unbanForm.saved} message="The ban was lifted." />
		</Card.Footer>
	{/if}
</Card.Root>
