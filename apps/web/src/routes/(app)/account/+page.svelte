<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { SubmitFunction } from '$app/forms';
	import { ArrowLeft, CircleAlert, LogOut, UserRound } from '@lucide/svelte';
	import { call } from '#lib/call.svelte.ts';
	import PictureForm from '#lib/components/images/picture-form.svelte';
	import ProviderIcon from '#lib/components/social/provider-icon.svelte';
	import * as Alert from '#lib/components/ui/alert/index.ts';
	import * as AlertDialog from '#lib/components/ui/alert-dialog/index.ts';
	import { Button, buttonVariants } from '#lib/components/ui/button/index.ts';
	import { Badge } from '#lib/components/ui/badge/index.ts';
	import * as Card from '#lib/components/ui/card/index.ts';
	import * as Item from '#lib/components/ui/item/index.ts';
	import { Input } from '#lib/components/ui/input/index.ts';
	import { Label } from '#lib/components/ui/label/index.ts';
	import { forgetGuest, NAME_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '#lib/guests.ts';
	import { PROVIDER_NAMES, providerList } from '#lib/social.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// Members sign in with their password, so the guest session in this browser is no longer needed.
	const createAccount: SubmitFunction = () => {
		return async ({ result, update }) => {
			if (result.type === 'success') forgetGuest();
			await update();
		};
	};

	let signOutOpen = $state(false);

	// The guest saved in this browser cannot sign back in after signing out, so forget it.
	const signOut: SubmitFunction = () => {
		return async ({ update }) => {
			forgetGuest();
			signOutOpen = false;
			await call.leave();
			await update();
		};
	};
</script>

{#snippet signOutForm(label: string)}
	<form method="post" action={resolve('/logout')} use:enhance={signOut} class="w-full sm:w-fit">
		<Button type="submit" variant="destructive" class="w-full sm:w-fit">
			<LogOut />
			{label}
		</Button>
	</form>
{/snippet}

<svelte:head>
	<title>Account · Lumio</title>
</svelte:head>

<div class="flex min-w-0 flex-1 flex-col">
	<header class="flex h-12 shrink-0 items-center gap-2 border-b px-3">
		<a
			href={resolve('/(app)/(home)')}
			class={buttonVariants({ variant: 'ghost', size: 'icon', class: '-ml-1 size-8' })}
			aria-label="Back to Home"
		>
			<ArrowLeft />
		</a>
		<UserRound class="size-4 text-muted-foreground" />
		<h1 class="truncate font-semibold">Account</h1>
	</header>

	<div class="min-h-0 flex-1 overflow-y-auto">
		<div class="mx-auto grid max-w-md grid-cols-[minmax(0,1fr)] gap-6 p-4">
			<Card.Root role="region" aria-labelledby="picture-heading">
				<Card.Header>
					<Card.Title><h2 id="picture-heading">Profile picture</h2></Card.Title>
					<Card.Description>
						Shown next to your name in chats, member lists and calls. Pictures are cropped to a
						square.
					</Card.Description>
				</Card.Header>
				<Card.Content>
					<PictureForm
						uploadAction="?/picture"
						removeAction="?/removePicture"
						image={data.user.image}
						name={data.user.name}
						label="profile picture"
					/>
				</Card.Content>
			</Card.Root>

			{#if data.user.isGuest}
				<Card.Root role="region" aria-labelledby="create-account-heading">
					<Card.Header>
						<Card.Title><h2 id="create-account-heading">Create your account</h2></Card.Title>
						<Card.Description>
							You are a guest right now, saved only in this browser. Add an email and password to
							keep everything (messages, friends and roles) and to sign in on any device.
						</Card.Description>
					</Card.Header>
					<Card.Content>
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
								<Alert.Root variant="destructive">
									<CircleAlert />
									<Alert.Description>{form.message}</Alert.Description>
								</Alert.Root>
							{/if}
							<Button type="submit" class="w-full">Create account</Button>
						</form>
					</Card.Content>
				</Card.Root>
			{:else}
				<Card.Root role="region" aria-labelledby="account-heading">
					<Card.Header>
						<Card.Title>
							<h2 id="account-heading">
								{form?.upgraded ? 'Your account is ready' : 'Your account'}
							</h2>
						</Card.Title>
						{#if form?.upgraded}
							<Card.Description>
								Everything you did as a guest is kept. Sign in with your email and password on any
								device.
							</Card.Description>
						{/if}
					</Card.Header>
					<Card.Content>
						<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
							<dt class="text-muted-foreground">Name</dt>
							<dd class="truncate">{data.user.name}</dd>
							{#if data.email}
								<dt class="text-muted-foreground">Email</dt>
								<dd class="truncate">{data.email}</dd>
							{/if}
						</dl>
					</Card.Content>
				</Card.Root>

				{#if data.services.length > 0}
					{@const socialMessage = form?.socialMessage ?? data.socialError}
					<Card.Root role="region" aria-labelledby="services-heading">
						<Card.Header>
							<Card.Title><h2 id="services-heading">Connected accounts</h2></Card.Title>
							<Card.Description>
								Connect {providerList(data.services.map((s) => s.provider))} to sign in with it.
							</Card.Description>
						</Card.Header>
						<Card.Content class="grid gap-4">
							{#if socialMessage}
								<Alert.Root variant="destructive">
									<CircleAlert />
									<Alert.Description>{socialMessage}</Alert.Description>
								</Alert.Root>
							{/if}
							<div class="grid gap-2" role="list">
								{#each data.services as service (service.provider)}
									{@const name = PROVIDER_NAMES[service.provider]}
									<Item.Root
										variant="outline"
										size="sm"
										class="flex-nowrap py-2 pr-2"
										role="listitem"
										aria-label={name}
									>
										<Item.Media>
											<ProviderIcon provider={service.provider} class="size-5" />
										</Item.Media>
										<Item.Content class="min-w-0">
											<Item.Title>{name}</Item.Title>
											{#if service.connected}
												<Item.Description>
													<Badge variant="secondary">Connected</Badge>
												</Item.Description>
											{/if}
										</Item.Content>
										<Item.Actions>
											{#if !service.connected}
												<!-- No `use:enhance`: the action redirects to the service. -->
												<form method="post" action="?/connect">
													<Button
														type="submit"
														name="provider"
														value={service.provider}
														variant="outline"
														size="sm"
														aria-label="Connect {name}"
													>
														Connect
													</Button>
												</form>
											{:else if data.signInMethods > 1}
												<form method="post" action="?/disconnect" use:enhance>
													<Button
														type="submit"
														name="provider"
														value={service.provider}
														variant="ghost"
														size="sm"
														aria-label="Disconnect {name}"
													>
														Disconnect
													</Button>
												</form>
											{/if}
										</Item.Actions>
									</Item.Root>
								{/each}
							</div>
							{#if data.signInMethods === 1 && data.services.some((s) => s.connected)}
								<p class="text-sm text-muted-foreground">
									This is your only way to sign in, so it stays connected.
								</p>
							{/if}
						</Card.Content>
					</Card.Root>
				{/if}
			{/if}

			<Card.Root role="region" aria-labelledby="sign-out-heading">
				<Card.Header>
					<Card.Title><h2 id="sign-out-heading">Sign out</h2></Card.Title>
					<Card.Description>
						{#if data.user.isGuest}
							As a guest you have no password: after signing out you cannot get back into this guest
							account. Create an account first to keep it.
						{:else}
							Sign out of Lumio in this browser.
						{/if}
					</Card.Description>
				</Card.Header>
				<Card.Footer>
					{#if data.user.isGuest}
						<Button
							variant="destructive"
							class="w-full sm:w-fit"
							onclick={() => (signOutOpen = true)}
						>
							<LogOut />
							Sign out
						</Button>
					{:else}
						{@render signOutForm('Sign out')}
					{/if}
				</Card.Footer>
			</Card.Root>
		</div>
	</div>
</div>

<AlertDialog.Root bind:open={signOutOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Sign out and lose this guest account?</AlertDialog.Title>
			<AlertDialog.Description>
				Your messages stay, but you cannot sign in as {data.user.name} again. Create an account first
				if you want to keep it.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			{@render signOutForm('Sign out anyway')}
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
