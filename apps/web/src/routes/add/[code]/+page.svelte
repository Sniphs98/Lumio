<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import JoinForm from '#lib/components/join/join-form.svelte';
	import { CircleAlert } from '@lucide/svelte';
	import * as Alert from '#lib/components/ui/alert/index.ts';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.ts';
	import * as Card from '#lib/components/ui/card/index.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// Existing members sign in and come back here to add the friend.
	const redirectTo = $derived(encodeURIComponent(page.url.pathname));
</script>

<svelte:head>
	<title>
		{data.owner ? `Add ${data.owner.name} as a friend` : 'Friend link'} · Lumio
	</title>
</svelte:head>

<main class="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
	<Card.Root class="w-full max-w-sm">
		{#if !data.owner}
			<Card.Header>
				<Card.Title>This friend link is no longer valid</Card.Title>
				<Card.Description>
					It was reset or never existed. Ask your friend for their current link.
				</Card.Description>
			</Card.Header>
		{:else if data.state === 'own'}
			<Card.Header>
				<Card.Title>This is your friend link</Card.Title>
				<Card.Description>
					Send it to friends: whoever opens it becomes your friend on {data.instanceName}.
				</Card.Description>
			</Card.Header>
			<Card.Footer>
				<a href={resolve('/(app)/(home)')} class={buttonVariants({ class: 'w-full' })}>Go to Home</a
				>
			</Card.Footer>
		{:else if data.state === 'member'}
			<Card.Header>
				<Card.Title>Add {data.owner.name} as a friend</Card.Title>
				<Card.Description>
					{data.owner.name} sent you their friend link. You can chat and call each other right away.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<form method="post" action="?/befriend" use:enhance class="grid gap-4">
					{#if form?.message}
						<Alert.Root variant="destructive">
							<CircleAlert />
							<Alert.Description>{form.message}</Alert.Description>
						</Alert.Root>
					{/if}
					<Button type="submit" class="w-full">Add {data.owner.name}</Button>
				</form>
			</Card.Content>
		{:else}
			<Card.Header>
				<Card.Title>Become friends with {data.owner.name}</Card.Title>
				<Card.Description>
					{#if data.state === 'newcomer'}
						{data.owner.name} invited you to {data.instanceName}. Join as a guest with just a name,
						or create an account.
					{:else}
						Sign in to {data.instanceName} to add {data.owner.name} as a friend.
					{/if}
				</Card.Description>
			</Card.Header>
			{#if data.state === 'newcomer'}
				<Card.Content>
					<JoinForm allowGuests message={form?.message} />
				</Card.Content>
			{/if}
			<Card.Footer class="justify-center text-sm text-muted-foreground">
				Already have an account?
				<a
					href="{resolve('/login')}?redirectTo={redirectTo}"
					class={buttonVariants({ variant: 'link', class: 'px-1' })}>Sign in</a
				>
			</Card.Footer>
		{/if}
	</Card.Root>
</main>
