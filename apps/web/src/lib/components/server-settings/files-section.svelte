<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatBytes, type UploadQuotas } from '#lib/attachments.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import * as Card from '#lib/components/ui/card/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Label } from '#lib/components/ui/label/index.ts';
	import { Switch } from '#lib/components/ui/switch/index.ts';
	import FormResult from './form-result.svelte';
	import { settingsForm } from './settings-form.svelte.ts';

	let {
		action,
		maxUploadSize,
		quotas
	}: { action: string; maxUploadSize: number; quotas: UploadQuotas } = $props();

	const uploadsForm = settingsForm();
	const storageForm = settingsForm();

	const gb = (bytes: number) => Math.round((bytes / 1024 ** 3) * 10) / 10;
</script>

<div class="grid grid-cols-[minmax(0,1fr)] gap-6">
	<Card.Root role="region" aria-labelledby="uploads-heading">
		<Card.Header>
			<Card.Title><h3 id="uploads-heading">File sharing</h3></Card.Title>
			<Card.Description>
				Members can share files in channels and direct messages. Files are currently limited to
				{formatBytes(maxUploadSize)}.
			</Card.Description>
		</Card.Header>
		<form
			method="post"
			action="{action}?/uploads"
			use:enhance={uploadsForm.submit}
			class="grid gap-6"
		>
			<Card.Content class="grid gap-2">
				<Label for="max-upload-size">Largest file (MB)</Label>
				<Input
					id="max-upload-size"
					name="maxUploadSizeMb"
					type="number"
					inputmode="numeric"
					min="1"
					step="1"
					value={Math.round(maxUploadSize / 1024 ** 2)}
				/>
			</Card.Content>
			<Card.Footer class="flex-wrap gap-3">
				<Button type="submit">Save</Button>
				<FormResult error={uploadsForm.error} saved={uploadsForm.saved} />
			</Card.Footer>
		</form>
	</Card.Root>

	<Card.Root role="region" aria-labelledby="storage-heading">
		<Card.Header>
			<Card.Title><h3 id="storage-heading">Storage per person</h3></Card.Title>
			<Card.Description>
				Limits the total size of the files each person has shared, so nobody can fill up the server.
				Deleting a message frees up the space of its files.
			</Card.Description>
		</Card.Header>
		<form
			method="post"
			action="{action}?/storage"
			use:enhance={storageForm.submit}
			class="grid gap-6"
		>
			<Card.Content class="grid gap-4 sm:grid-cols-2">
				<Label class="font-normal sm:col-span-2">
					<Switch name="quotaEnabled" checked={quotas.enabled} />
					Limit storage per person
				</Label>
				<div class="grid gap-2">
					<Label for="member-quota">Members (GB)</Label>
					<Input
						id="member-quota"
						name="memberQuotaGb"
						type="number"
						inputmode="decimal"
						min="0.1"
						step="0.1"
						value={gb(quotas.member)}
					/>
				</div>
				<div class="grid gap-2">
					<Label for="guest-quota">Guests (GB)</Label>
					<Input
						id="guest-quota"
						name="guestQuotaGb"
						type="number"
						inputmode="decimal"
						min="0.1"
						step="0.1"
						value={gb(quotas.guest)}
					/>
				</div>
			</Card.Content>
			<Card.Footer class="flex-wrap gap-3">
				<Button type="submit">Save</Button>
				<FormResult error={storageForm.error} saved={storageForm.saved} />
			</Card.Footer>
		</form>
	</Card.Root>
</div>
