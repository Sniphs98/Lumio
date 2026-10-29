<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '#lib/components/ui/button/index.ts';
	import * as Card from '#lib/components/ui/card/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Label } from '#lib/components/ui/label/index.ts';
	import { Switch } from '#lib/components/ui/switch/index.ts';
	import { SERVER_NAME_MAX_LENGTH } from '#lib/instance.ts';
	import FormResult from './form-result.svelte';
	import { settingsForm } from './settings-form.svelte.ts';

	let { action, name, isPublic }: { action: string; name: string; isPublic: boolean } = $props();

	const nameForm = settingsForm();
	const accessForm = settingsForm();
</script>

<div class="grid grid-cols-[minmax(0,1fr)] gap-6">
	<Card.Root role="region" aria-labelledby="server-name-heading">
		<Card.Header>
			<Card.Title><h3 id="server-name-heading">Server name</h3></Card.Title>
			<Card.Description>Shown on the server's tab for everyone.</Card.Description>
		</Card.Header>
		<form method="post" action="{action}?/name" use:enhance={nameForm.submit} class="grid gap-6">
			<Card.Content class="grid gap-2">
				<Label for="server-name">Name</Label>
				<Input
					id="server-name"
					name="name"
					value={name}
					required
					maxlength={SERVER_NAME_MAX_LENGTH}
					autocomplete="off"
				/>
			</Card.Content>
			<Card.Footer class="flex-wrap gap-3">
				<Button type="submit">Save</Button>
				<FormResult error={nameForm.error} saved={nameForm.saved} />
			</Card.Footer>
		</form>
	</Card.Root>

	<Card.Root role="region" aria-labelledby="access-heading">
		<Card.Header>
			<Card.Title><h3 id="access-heading">Who can invite people</h3></Card.Title>
			<Card.Description>
				On a private server only members with an account can bring in new people. Guests can still
				add existing members as friends. On a public server guests can invite people too.
			</Card.Description>
		</Card.Header>
		<form
			method="post"
			action="{action}?/access"
			use:enhance={accessForm.submit}
			class="grid gap-6"
		>
			<Card.Content>
				<Label class="font-normal">
					<Switch name="isPublic" checked={isPublic} />
					Public server: guests can invite people
				</Label>
			</Card.Content>
			<Card.Footer class="flex-wrap gap-3">
				<Button type="submit">Save</Button>
				<FormResult error={accessForm.error} saved={accessForm.saved} />
			</Card.Footer>
		</form>
	</Card.Root>
</div>
