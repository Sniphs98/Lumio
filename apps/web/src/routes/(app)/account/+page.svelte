<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from '$app/forms';
	import { ArrowLeft, UserRound } from '@lucide/svelte';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Label } from '#lib/components/ui/label/index.ts';
	import { forgetGuest, NAME_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '#lib/guests.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// Members sign in with their password, so the guest session in this browser is no longer needed.
	const createAccount: SubmitFunction = () => {
		return async ({ result, update }) => {
			if (result.type === 'success') forgetGuest();
			await update();
		};
	};
</script>

<svelte:head>
	<title>Account · Lumio</title>
</svelte:head>

<div class="flex min-w-0 flex-1 flex-col">
	<header class="flex h-12 shrink-0 items-center gap-2 border-b px-3">
		<a
			href={resolve('/(app)/(home)')}
			class="-ml-1 flex size-8 items-center justify-center rounded-md hover:bg-muted"
			aria-label="Back to Home"
		>
			<ArrowLeft class="size-4" />
		</a>
		<UserRound class="size-4 text-muted-foreground" />
		<h1 class="truncate font-semibold">Account</h1>
	</header>

	<div class="min-h-0 flex-1 overflow-y-auto">
		<div class="mx-auto grid max-w-md gap-6 p-4">
			{#if data.user.isGuest}
				<section class="grid gap-4" aria-labelledby="create-account-heading">
					<div class="grid gap-1">
						<h2 id="create-account-heading" class="font-semibold">Create your account</h2>
						<p class="text-sm text-muted-foreground">
							You are a guest right now, saved only in this browser. Add an email and password to
							keep everything (messages, friends and roles) and to sign in on any device.
						</p>
					</div>
					<form
						method="post"
						action="?/createAccount"
						use:enhance={createAccount}
						class="grid gap-4"
					>
						<div class="grid gap-2">
							<Label for="name">Display name</Label>
							<Input
								id="name"
								name="name"
								required
								maxlength={NAME_MAX_LENGTH}
								value={data.user.name}
								autocomplete="nickname"
							/>
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
								minlength={PASSWORD_MIN_LENGTH}
								autocomplete="new-password"
							/>
						</div>
						{#if form?.message}
							<p class="text-sm text-destructive" role="alert">{form.message}</p>
						{/if}
						<Button type="submit" class="w-full">Create account</Button>
					</form>
				</section>
			{:else}
				<section class="grid gap-2" aria-labelledby="account-heading">
					<h2 id="account-heading" class="font-semibold">
						{form?.upgraded ? 'Your account is ready' : 'Your account'}
					</h2>
					{#if form?.upgraded}
						<p class="text-sm text-muted-foreground">
							Everything you did as a guest is kept. Sign in with your email and password on any
							device.
						</p>
					{/if}
					<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
						<dt class="text-muted-foreground">Name</dt>
						<dd class="truncate">{data.user.name}</dd>
						<dt class="text-muted-foreground">Email</dt>
						<dd class="truncate">{data.email}</dd>
					</dl>
				</section>
			{/if}
		</div>
	</div>
</div>
