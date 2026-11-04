<script lang="ts">
	import * as Avatar from '#lib/components/ui/avatar/index.ts';
	import { cn } from '#lib/utils.ts';

	type Props = {
		/** Also used for groups and the server: their name and picture. */
		user: { name: string; image?: string | null };
		size?: 'sm' | 'default' | 'lg';
		/** Rounded corners instead of a circle, for the server icon and group pictures. */
		square?: boolean;
		class?: string;
		fallbackClass?: string;
	};

	let { user, size = 'sm', square = false, class: className, fallbackClass }: Props = $props();

	const shape = $derived(square ? 'rounded-[25%]' : undefined);
</script>

<!--
	Profile picture, or the first letter of the name while there is none. Recreated when the
	picture changes: the avatar keeps showing the picture it loaded first otherwise.
-->
{#key user.image}
	<Avatar.Root
		{size}
		class={cn(square && 'rounded-[25%] after:rounded-[25%]', className)}
		aria-hidden="true"
	>
		{#if user.image}
			<Avatar.Image src={user.image} alt="" class={shape} />
		{/if}
		<Avatar.Fallback class={cn(shape, fallbackClass)}>
			{user.name.slice(0, 1).toUpperCase()}
		</Avatar.Fallback>
	</Avatar.Root>
{/key}
