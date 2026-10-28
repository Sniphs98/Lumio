<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '#lib/components/ui/button/index.ts';
	import * as Card from '#lib/components/ui/card/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Label } from '#lib/components/ui/label/index.ts';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let mode = $state<'signIn' | 'signUp'>('signIn');
</script>

<main class="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
	<Card.Root class="w-full max-w-sm">
		<Card.Header>
			<Card.Title>{mode === 'signIn' ? 'Welcome back' : 'Create an account'}</Card.Title>
			<Card.Description>
				{mode === 'signIn' ? 'Sign in to your Lumio server.' : 'Join this Lumio server.'}
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<form method="post" action="?/{mode}" use:enhance class="grid gap-4">
				{#if mode === 'signUp'}
					<div class="grid gap-2">
						<Label for="name">Display name</Label>
						<Input id="name" name="name" required autocomplete="nickname" />
					</div>
				{/if}
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
						autocomplete={mode === 'signIn' ? 'current-password' : 'new-password'}
					/>
				</div>
				{#if form?.message}
					<p class="text-sm text-destructive">{form.message}</p>
				{/if}
				<Button type="submit" class="w-full">
					{mode === 'signIn' ? 'Sign in' : 'Create account'}
				</Button>
			</form>
		</Card.Content>
		<Card.Footer class="justify-center text-sm text-muted-foreground">
			{#if mode === 'signIn'}
				No account yet?
				<Button variant="link" class="px-1" onclick={() => (mode = 'signUp')}>Register</Button>
			{:else}
				Already registered?
				<Button variant="link" class="px-1" onclick={() => (mode = 'signIn')}>Sign in</Button>
			{/if}
		</Card.Footer>
	</Card.Root>
</main>
