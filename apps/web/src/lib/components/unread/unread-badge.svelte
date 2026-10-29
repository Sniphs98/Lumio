<script lang="ts">
	import { Badge } from '#lib/components/ui/badge/index.ts';
	import { describeUnread, formatCount, type UnreadCount } from '#lib/unread.ts';
	import { cn } from '#lib/utils.ts';

	let { unread, class: className }: { unread: UnreadCount; class?: string } = $props();
</script>

<!-- Number of unread messages; red when one of them mentions the user. -->
{#if unread.count > 0}
	<Badge
		class={cn(
			'ml-auto h-4 min-w-4 px-1 text-[0.625rem] leading-none font-semibold tabular-nums',
			unread.mentions > 0 ? 'bg-destructive text-white' : 'bg-foreground/80 text-background',
			className
		)}
		role="status"
		aria-label={describeUnread(unread)}
		title={describeUnread(unread)}
	>
		{unread.mentions > 0 ? `@${formatCount(unread.mentions)}` : formatCount(unread.count)}
	</Badge>
{/if}
