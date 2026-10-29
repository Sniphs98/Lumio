<script lang="ts" generics="T = never">
	import { Tooltip as TooltipPrimitive } from 'bits-ui';
	import TooltipProvider from './tooltip-provider.svelte';

	let { open = $bindable(false), ...restProps }: TooltipPrimitive.RootProps<T> = $props();
</script>

<!-- Like shadcn/ui, every tooltip brings its own provider, so it also works in component tests. -->
<TooltipProvider>
	<TooltipPrimitive.Root bind:open {...restProps} />
</TooltipProvider>
