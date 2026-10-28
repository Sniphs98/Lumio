<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.ts';
	import * as Dialog from '#lib/components/ui/dialog/index.ts';

	/** Shown once per visit when a guest comes back. */
	let { open = $bindable(false) }: { open?: boolean } = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Welcome back! Create an account?</Dialog.Title>
			<Dialog.Description>
				You are using Lumio as a guest, saved only in this browser. With an account nothing gets
				lost when the browser data is cleared, and you can sign in on any device with everything as
				you left it: your messages, friends and roles stay.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)}>Not now</Button>
			<a href={resolve('/(app)/account')} class={buttonVariants()} onclick={() => (open = false)}>
				Create account
			</a>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
