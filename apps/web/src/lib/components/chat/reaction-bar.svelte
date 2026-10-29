<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.ts';
	import * as Tooltip from '#lib/components/ui/tooltip/index.ts';
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
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<!-- Wrapped, so the tooltip also shows on chips that cannot be clicked. -->
						<span {...props} class="inline-flex">
							<Button
								variant="outline"
								size="sm"
								class={cn(
									'h-6 gap-1 rounded-full px-2 text-xs tabular-nums shadow-none disabled:opacity-100 has-[>svg]:px-2',
									mine ? 'border-primary/60 bg-primary/10 hover:bg-primary/15' : 'bg-muted/50'
								)}
								aria-pressed={mine}
								aria-label="{reaction.emoji} {reaction.users.length}"
								disabled={!canReact}
								onclick={() => ontoggle(reaction.emoji)}
							>
								<span class="text-sm leading-none">{reaction.emoji}</span>
								{reaction.users.length}
							</Button>
						</span>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content>{describeReaction(reaction, meId)}</Tooltip.Content>
			</Tooltip.Root>
		</li>
	{/each}
</ul>
