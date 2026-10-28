<script lang="ts">
	import { describeReaction, type Reaction } from '#lib/reactions.ts';
	import { cn } from '#lib/utils.ts';

	type Props = {
		reactions: Reaction[];
		meId?: string;
		/** Whether the user may add reactions; otherwise the chips only show counts. */
		canReact: boolean;
		ontoggle: (emoji: string) => void;
	};

	let { reactions, meId, canReact, ontoggle }: Props = $props();
</script>

<ul class="flex flex-wrap gap-1 py-1" aria-label="Reactions">
	{#each reactions as reaction (reaction.emoji)}
		{@const mine = reaction.users.some((u) => u.id === meId)}
		<li>
			<button
				type="button"
				class={cn(
					'flex h-6 items-center gap-1 rounded-full border px-2 text-xs tabular-nums transition-colors',
					mine ? 'border-primary/60 bg-primary/10' : 'bg-muted/50 hover:border-foreground/30',
					!canReact && 'cursor-default'
				)}
				aria-pressed={mine}
				aria-label="{reaction.emoji} {reaction.users.length}"
				title={describeReaction(reaction, meId)}
				disabled={!canReact}
				onclick={() => ontoggle(reaction.emoji)}
			>
				<span class="text-sm leading-none">{reaction.emoji}</span>
				{reaction.users.length}
			</button>
		</li>
	{/each}
</ul>
