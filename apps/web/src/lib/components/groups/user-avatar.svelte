<script lang="ts">
	import * as Avatar from '#lib/components/ui/avatar/index.ts';

	type Props = {
		user: { name: string; image?: string | null };
		size?: 'sm' | 'default' | 'lg';
		class?: string;
		fallbackClass?: string;
	};

	let { user, size = 'sm', class: className, fallbackClass }: Props = $props();
</script>

<!-- Profile picture, or the first letter of the name while there is none. -->
<Avatar.Root {size} class={className} aria-hidden="true">
	{#if user.image}
		<Avatar.Image src={user.image} alt="" />
	{/if}
	<Avatar.Fallback class={fallbackClass}>{user.name.slice(0, 1).toUpperCase()}</Avatar.Fallback>
</Avatar.Root>
