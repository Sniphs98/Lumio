<script lang="ts">
	import type { ChatUser } from '#lib/chat.ts';
	import { gifInContent, gifMediaPath } from '#lib/gifs.ts';
	import { splitContent } from '#lib/mentions.ts';
	import { cn } from '#lib/utils.ts';

	type Props = {
		content: string;
		/** Users mentioned in the content, to show their names. */
		mentions: ChatUser[];
		/** The signed-in user; mentions of them stand out. */
		meId?: string;
		class?: string;
	};

	let { content, mentions, meId, class: className }: Props = $props();

	const gif = $derived(gifInContent(content));
	const parts = $derived(splitContent(content));
	const nameOf = (id: string) => mentions.find((u) => u.id === id)?.name ?? 'unknown';
</script>

{#if gif}
	<!-- A fixed height, so the chat does not jump while the GIF loads. -->
	<img
		src={gifMediaPath(gif)}
		alt="GIF"
		loading="lazy"
		class={cn('my-1 h-48 w-auto max-w-full rounded-md object-contain object-left', className)}
	/>
{:else}
	<p class={cn('text-sm break-words whitespace-pre-wrap', className)}>
		{#each parts as part, i (i)}
			{#if part.type === 'text'}{part.text}{:else}<span
					class={cn(
						'rounded px-0.5 font-medium',
						part.userId === meId
							? 'bg-amber-500/25 text-amber-700 dark:text-amber-300'
							: 'bg-primary/10 text-primary'
					)}
					data-mention={part.userId}>@{nameOf(part.userId)}</span
				>{/if}
		{/each}
	</p>
{/if}
