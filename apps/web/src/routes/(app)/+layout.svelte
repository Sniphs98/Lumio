<script lang="ts">
	import TabBar from '#lib/components/shell/tab-bar.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<div class="flex h-dvh flex-col bg-background text-foreground">
	<TabBar instanceName={data.instance.name} />
	<div class="flex min-h-0 flex-1">
		{@render children()}
	</div>
	<!-- TODO: call bar, visible on every tab while a call is active -->
</div>
