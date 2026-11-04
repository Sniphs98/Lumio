<script lang="ts">
	import { applyAction, enhance, type ActionResult, type SubmitFunction } from '$app/forms';
	import { refreshAll } from '$app/navigation';
	import { CircleAlert, ImageUp, Trash2 } from '@lucide/svelte';
	import UserAvatar from '#lib/components/groups/user-avatar.svelte';
	import * as Alert from '#lib/components/ui/alert/index.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { prepareImage } from '#lib/image-resize.ts';
	import { IMAGE_ACCEPT } from '#lib/images.ts';

	type Props = {
		/** Form action that receives the picture in the `image` field. */
		uploadAction: string;
		/** Form action that removes the picture. */
		removeAction: string;
		/** The current picture, if any. */
		image: string | null;
		/** Shown as a letter while there is no picture. */
		name: string;
		/** What the picture is, for screen readers, e.g. "profile picture". */
		label: string;
		/** Rounded corners instead of a circle, for the server icon and group pictures. */
		square?: boolean;
	};

	let { uploadAction, removeAction, image, name, label, square = false }: Props = $props();

	let input = $state<HTMLInputElement>();
	let uploadForm = $state<HTMLFormElement>();
	let busy = $state(false);
	let error = $state<string>();

	// The actions may live on another route (the server settings), so the result is shown here
	// and the data reloaded instead of applying it to the page that happens to be open.
	function finish() {
		return async ({ result }: { result: ActionResult }) => {
			busy = false;
			if (input) input.value = '';
			if (result.type === 'success') await refreshAll();
			else if (result.type === 'failure')
				error = String(result.data?.error ?? 'That did not work.');
			else await applyAction(result);
		};
	}

	const upload: SubmitFunction = async ({ formData, cancel }) => {
		const file = formData.get('image');
		if (!(file instanceof File) || file.size === 0) {
			cancel();
			return;
		}
		busy = true;
		error = undefined;
		formData.set('image', await prepareImage(file));
		return finish();
	};

	const remove: SubmitFunction = () => {
		busy = true;
		error = undefined;
		return finish();
	};
</script>

<div class="grid gap-3">
	<div class="flex flex-wrap items-center gap-4">
		<UserAvatar
			user={{ name, image }}
			{square}
			class="size-20 data-[size=sm]:size-20"
			fallbackClass="text-2xl font-semibold"
		/>
		<div class="flex flex-wrap gap-2">
			<form
				bind:this={uploadForm}
				method="post"
				action={uploadAction}
				enctype="multipart/form-data"
				use:enhance={upload}
			>
				<!-- Hidden: the button below opens the file picker and the form is sent on choosing. -->
				<input
					bind:this={input}
					type="file"
					name="image"
					accept={IMAGE_ACCEPT}
					class="sr-only"
					tabindex="-1"
					aria-label="Choose a {label}"
					onchange={() => uploadForm?.requestSubmit()}
				/>
				<Button type="button" variant="secondary" disabled={busy} onclick={() => input?.click()}>
					<ImageUp />
					{image ? 'Change picture' : 'Upload picture'}
				</Button>
			</form>
			{#if image}
				<form method="post" action={removeAction} use:enhance={remove}>
					<Button type="submit" variant="ghost" disabled={busy} aria-label="Remove {label}">
						<Trash2 />
						Remove
					</Button>
				</form>
			{/if}
		</div>
	</div>
	{#if error}
		<Alert.Root variant="destructive">
			<CircleAlert />
			<Alert.Description>{error}</Alert.Description>
		</Alert.Root>
	{/if}
</div>
