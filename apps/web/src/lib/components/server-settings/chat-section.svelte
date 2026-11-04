<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '#lib/components/ui/button/index.ts';
	import * as Card from '#lib/components/ui/card/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Label } from '#lib/components/ui/label/index.ts';
	import FormResult from './form-result.svelte';
	import { settingsForm } from './settings-form.svelte.ts';

	let { action, gifs }: { action: string; gifs: { hasKey: boolean; fromEnv: boolean } } = $props();

	const gifsForm = settingsForm();
</script>

<div class="grid grid-cols-[minmax(0,1fr)] gap-6">
	<Card.Root role="region" aria-labelledby="gifs-heading">
		<Card.Header>
			<Card.Title><h3 id="gifs-heading">GIFs</h3></Card.Title>
			<Card.Description>
				{#if gifs.fromEnv}
					GIF search is set up on the server with an environment variable. Change it there.
				{:else if gifs.hasKey}
					GIF search is on. Everyone finds GIFs with the GIF button next to the message box.
				{:else}
					Turn on GIF search with a free API key: create an app on the
					<a
						href="https://developers.giphy.com/dashboard/"
						target="_blank"
						rel="noreferrer"
						class="underline underline-offset-4">GIPHY developer dashboard</a
					>
					(choose “API”) and paste its key here.
				{/if}
			</Card.Description>
		</Card.Header>
		{#if !gifs.fromEnv}
			<form method="post" action="{action}?/gifs" use:enhance={gifsForm.submit} class="grid gap-6">
				<Card.Content class="grid gap-2">
					<Label for="giphy-api-key">GIPHY API key</Label>
					<Input
						id="giphy-api-key"
						name="giphyApiKey"
						type="password"
						autocomplete="off"
						spellcheck={false}
						placeholder={gifs.hasKey ? 'Saved. Paste a new key to replace it.' : 'Paste your key'}
					/>
				</Card.Content>
				<Card.Footer class="flex-wrap gap-3">
					<Button type="submit">Save</Button>
					{#if gifs.hasKey}
						<Button type="submit" variant="outline" name="remove" value="on">Turn off GIFs</Button>
					{/if}
					<FormResult error={gifsForm.error} saved={gifsForm.saved} />
				</Card.Footer>
			</form>
		{/if}
	</Card.Root>
</div>
