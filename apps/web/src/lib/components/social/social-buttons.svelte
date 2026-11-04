<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Separator } from '#lib/components/ui/separator/index.ts';
	import { PROVIDER_NAMES, type SocialProvider } from '#lib/social.ts';
	import ProviderIcon from './provider-icon.svelte';

	type Props = {
		/** Form action that sends the user to the chosen service, e.g. `?/social`. */
		action: string;
		/** The services this Lumio offers. Nothing is shown without any. */
		providers: SocialProvider[];
	};

	let { action, providers }: Props = $props();
</script>

{#if providers.length > 0}
	<!-- No `use:enhance`: the action redirects to the service, a full page load either way. -->
	<div class="grid gap-4">
		<form method="post" {action} class="grid gap-2">
			{#each providers as provider (provider)}
				<Button type="submit" name="provider" value={provider} variant="outline" class="w-full">
					<ProviderIcon {provider} />
					Continue with {PROVIDER_NAMES[provider]}
				</Button>
			{/each}
		</form>
		<div class="flex items-center gap-3 text-xs text-muted-foreground">
			<Separator class="flex-1" />
			or
			<Separator class="flex-1" />
		</div>
	</div>
{/if}
