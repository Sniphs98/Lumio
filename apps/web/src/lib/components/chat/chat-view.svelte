<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { SendHorizontal } from '@lucide/svelte';
	import { onMount, tick } from 'svelte';
	import { Button } from '#lib/components/ui/button/index.ts';
	import {
		addMessage,
		MAX_MESSAGE_LENGTH,
		type ChannelEvent,
		type ChatMessage
	} from '#lib/chat.ts';

	type Props = {
		/** Server-loaded history, oldest first. */
		messages: ChatMessage[];
		/** Server-Sent Events stream with the live messages. */
		eventsUrl: string;
		/** Name of the chat in the composer, e.g. `#general` or a friend's name. */
		label: string;
		emptyText: string;
		canSend: boolean;
		cannotSendText: string;
		/** Error returned by the page's `send` form action. */
		error?: string;
	};

	let {
		messages: initial,
		eventsUrl,
		label,
		emptyText,
		canSend,
		cannotSendText,
		error
	}: Props = $props();

	// Starts from the server-loaded history and resets when the chat changes.
	let messages = $derived(initial);
	let content = $state('');
	let sending = $state(false);
	let mounted = $state(false);
	let list: HTMLElement | undefined = $state();

	const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
	const dayFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

	onMount(() => {
		mounted = true;
		scrollToBottom();
	});

	function isNearBottom() {
		if (!list) return true;
		return list.scrollHeight - list.scrollTop - list.clientHeight < 120;
	}

	async function scrollToBottom() {
		await tick();
		list?.scrollTo({ top: list.scrollHeight });
	}

	async function receive(message: ChatMessage) {
		const stick = isNearBottom();
		messages = addMessage(messages, message);
		if (stick) await scrollToBottom();
	}

	// Live updates for the open chat.
	$effect(() => {
		const source = new EventSource(eventsUrl);
		let opened = false;

		source.addEventListener('open', () => {
			// After a reconnect, reload the history to pick up messages we missed.
			if (opened) invalidateAll();
			opened = true;
		});
		source.addEventListener('message.created', (e) => {
			const event = JSON.parse((e as MessageEvent<string>).data) as ChannelEvent;
			receive(event.message);
		});

		return () => source.close();
	});

	/** Show the author line when the author changes or more than 5 minutes passed. */
	function startsGroup(index: number) {
		if (index === 0) return true;
		const prev = messages[index - 1];
		const current = messages[index];
		const gap = Date.parse(current.createdAt) - Date.parse(prev.createdAt);
		return prev.author.id !== current.author.id || gap > 5 * 60_000;
	}

	function onKeydown(event: KeyboardEvent) {
		// Enter sends, Shift+Enter adds a line break.
		if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
			event.preventDefault();
			(event.currentTarget as HTMLTextAreaElement).form?.requestSubmit();
		}
	}
</script>

<ol
	bind:this={list}
	class="flex min-h-0 flex-1 flex-col overflow-y-auto py-4"
	aria-label="Messages"
>
	{#if messages.length === 0}
		<li class="m-auto px-4 text-center text-sm text-muted-foreground">{emptyText}</li>
	{/if}
	{#each messages as message, i (message.id)}
		<li class="px-4 hover:bg-muted/40 {startsGroup(i) ? 'mt-3 pt-1' : ''}">
			{#if startsGroup(i)}
				<div class="flex items-baseline gap-2">
					<span class="text-sm font-semibold">{message.author.name}</span>
					<time
						datetime={message.createdAt}
						class="text-xs text-muted-foreground"
						title={mounted ? dayFormat.format(new Date(message.createdAt)) : undefined}
					>
						{mounted ? timeFormat.format(new Date(message.createdAt)) : ''}
					</time>
				</div>
			{/if}
			<p class="text-sm break-words whitespace-pre-wrap">{message.content}</p>
		</li>
	{/each}
</ol>

<footer class="shrink-0 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
	{#if canSend}
		<form
			method="post"
			action="?/send"
			class="flex items-end gap-2"
			use:enhance={() => {
				sending = true;
				return async ({ result, update }) => {
					sending = false;
					if (result.type === 'success' && result.data?.message) {
						content = '';
						await receive(result.data.message as ChatMessage);
						await scrollToBottom();
					} else {
						await update({ reset: false, invalidateAll: false });
					}
				};
			}}
		>
			<textarea
				name="content"
				bind:value={content}
				onkeydown={onKeydown}
				rows="1"
				maxlength={MAX_MESSAGE_LENGTH}
				placeholder="Message {label}"
				aria-label="Message {label}"
				class="field-sizing-content max-h-40 min-h-9 flex-1 resize-none rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
			></textarea>
			<Button
				type="submit"
				size="icon"
				disabled={sending || content.trim() === ''}
				aria-label="Send"
			>
				<SendHorizontal />
			</Button>
		</form>
		{#if error}
			<p class="pt-2 text-sm text-destructive" role="alert">{error}</p>
		{/if}
	{:else}
		<p class="text-center text-sm text-muted-foreground">{cannotSendText}</p>
	{/if}
</footer>
