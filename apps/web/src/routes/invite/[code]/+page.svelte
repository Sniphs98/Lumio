<script lang="ts">
	import { resolve } from '$app/paths';
	import JoinForm from '#lib/components/join/join-form.svelte';
	import { buttonVariants } from '#lib/components/ui/button/index.ts';
	import * as Card from '#lib/components/ui/card/index.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>Join {data.instanceName} · Lumio</title>
</svelte:head>

<main class="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
	<Card.Root class="w-full max-w-sm">
		{#if data.invite}
			<Card.Header>
				<Card.Title>Join {data.instanceName}</Card.Title>
				<Card.Description>
					{data.invite.inviterName} invited you.
					{data.invite.allowGuests
						? 'Join as a guest with just a name, or create an account.'
						: 'Create an account to join.'}
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<JoinForm allowGuests={data.invite.allowGuests} message={form?.message} />
			</Card.Content>
		{:else}
			<Card.Header>
				<Card.Title>This invite is no longer valid</Card.Title>
				<Card.Description>
					The link has expired, was used up or was revoked. Ask whoever sent it for a new one.
				</Card.Description>
			</Card.Header>
		{/if}
		<Card.Footer class="justify-center text-sm text-muted-foreground">
			Already have an account?
			<a href={resolve('/login')} class={buttonVariants({ variant: 'link', class: 'px-1' })}
				>Sign in</a
			>
		</Card.Footer>
	</Card.Root>
</main>
