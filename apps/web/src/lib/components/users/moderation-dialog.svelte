<script lang="ts" module>
	import type { ModerationAction } from '#lib/moderation.ts';

	/** The kick or ban waiting for confirmation. */
	export type ModerationTarget = {
		action: ModerationAction;
		id: string;
		name: string;
		isGuest: boolean;
	};
</script>

<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { CircleAlert } from '@lucide/svelte';
	import * as Alert from '#lib/components/ui/alert/index.ts';
	import * as AlertDialog from '#lib/components/ui/alert-dialog/index.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Label } from '#lib/components/ui/label/index.ts';
	import { BAN_REASON_MAX_LENGTH } from '#lib/moderation.ts';

	let { target, open = $bindable(false) }: { target: ModerationTarget | null; open?: boolean } =
		$props();

	// The actions live on the members page, so kicking and banning work the same from everywhere.
	const members = resolve('/(app)/channels/members');

	/** Shown in the dialog, so it also works on pages without their own error alert. */
	let failed = $state<{ target: ModerationTarget; error: string } | null>(null);
	const error = $derived(failed?.target === target ? failed.error : '');
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Content>
		{#if target}
			{@const current = target}
			<form
				method="post"
				action="{members}?/{current.action}"
				use:enhance={() =>
					async ({ result, update }) => {
						if (result.type === 'failure') {
							failed = {
								target: current,
								error: String(result.data?.error ?? 'That did not work.')
							};
							return;
						}
						open = false;
						// Also shows the result when the members page is open.
						await update();
					}}
				class="grid gap-4"
			>
				<input type="hidden" name="userId" value={current.id} />
				<AlertDialog.Header>
					<AlertDialog.Title>
						{current.action === 'kick' ? 'Kick' : 'Ban'}
						{current.name}?
					</AlertDialog.Title>
					<AlertDialog.Description>
						{#if current.action === 'ban'}
							They are signed out on every device and cannot sign in again until you lift the ban.
						{:else if current.isGuest}
							They are signed out on every device. Guests have no password, so they lose access for
							good.
						{:else}
							They are signed out on every device and taken out of calls. With their password they
							can sign in again; ban them to keep them out.
						{/if}
					</AlertDialog.Description>
				</AlertDialog.Header>
				{#if current.action === 'ban'}
					<div class="grid gap-2">
						<Label for="ban-reason">Reason (optional)</Label>
						<Input id="ban-reason" name="reason" maxlength={BAN_REASON_MAX_LENGTH} />
					</div>
				{/if}
				{#if error}
					<Alert.Root variant="destructive">
						<CircleAlert />
						<Alert.Description>{error}</Alert.Description>
					</Alert.Root>
				{/if}
				<AlertDialog.Footer>
					<AlertDialog.Cancel type="button">Cancel</AlertDialog.Cancel>
					<Button type="submit" variant="destructive">
						{current.action === 'kick' ? 'Kick' : 'Ban'}
					</Button>
				</AlertDialog.Footer>
			</form>
		{/if}
	</AlertDialog.Content>
</AlertDialog.Root>
