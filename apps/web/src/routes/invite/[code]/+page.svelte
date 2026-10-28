<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.ts';
	import * as Card from '#lib/components/ui/card/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Label } from '#lib/components/ui/label/index.ts';
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
					{data.invite.inviterName} invited you. Create an account to join.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<form method="post" use:enhance class="grid gap-4">
					<div class="grid gap-2">
						<Label for="name">Display name</Label>
						<Input id="name" name="name" required autocomplete="nickname" />
					</div>
					<div class="grid gap-2">
						<Label for="email">Email</Label>
						<Input id="email" name="email" type="email" required autocomplete="email" />
					</div>
					<div class="grid gap-2">
						<Label for="password">Password</Label>
						<Input
							id="password"
							name="password"
							type="password"
							required
							minlength={8}
							autocomplete="new-password"
						/>
					</div>
					{#if form?.message}
						<p class="text-sm text-destructive" role="alert">{form.message}</p>
					{/if}
					<Button type="submit" class="w-full">Create account and join</Button>
				</form>
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
