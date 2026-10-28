<script lang="ts">
	import { deserialize, enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import {
		CornerUpLeft,
		FileText,
		Paperclip,
		Reply,
		RotateCw,
		SendHorizontal,
		X
	} from '@lucide/svelte';
	import { onMount, tick, untrack } from 'svelte';
	import { formatBytes, MAX_ATTACHMENTS_PER_MESSAGE } from '#lib/attachments.ts';
	import AttachmentView from '#lib/components/chat/attachment-view.svelte';
	import EmojiPicker from '#lib/components/chat/emoji-picker.svelte';
	import MentionSuggestions from '#lib/components/chat/mention-suggestions.svelte';
	import MessageContent from '#lib/components/chat/message-content.svelte';
	import ReactionBar from '#lib/components/chat/reaction-bar.svelte';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Progress } from '#lib/components/ui/progress/index.ts';
	import { Textarea } from '#lib/components/ui/textarea/index.ts';
	import {
		addMessage,
		MAX_MESSAGE_LENGTH,
		setReactions,
		type ChannelEvent,
		type ChatMessage,
		type ChatUser
	} from '#lib/chat.ts';
	import { activeMention, contentToText, encodeMentions, suggestMentions } from '#lib/mentions.ts';
	import type { Reaction } from '#lib/reactions.ts';
	import { cn } from '#lib/utils.ts';
	import { checkFile, PendingUpload } from '#lib/uploads.svelte.ts';

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
		/** The chat files are uploaded for, e.g. `channel:<id>`. Without it, sharing files is off. */
		uploadTarget?: string;
		/** Largest file that may be shared, in bytes. */
		maxUploadSize?: number;
		/** The signed-in user: their reactions and mentions of them stand out. */
		meId?: string;
		/** People the composer suggests after `@`. */
		mentionable?: ChatUser[];
		/** Whether the user may react to messages. */
		canReact?: boolean;
		/** Called whenever the chat is marked as read up to its latest message. */
		onread?: () => void;
	};

	let {
		messages: initial,
		eventsUrl,
		label,
		emptyText,
		canSend,
		cannotSendText,
		error,
		uploadTarget,
		maxUploadSize = 0,
		meId,
		mentionable = [],
		canReact = false,
		onread
	}: Props = $props();

	// Starts from the server-loaded history and resets when the chat changes.
	let messages = $derived(initial);
	let content = $state('');
	let sending = $state(false);
	let mounted = $state(false);
	let list: HTMLElement | undefined = $state();
	let fileInput: HTMLInputElement | undefined = $state();
	let uploads: PendingUpload[] = $state([]);
	let uploadError = $state('');
	let dragging = $state(false);
	let textarea: HTMLTextAreaElement | null = $state(null);
	let replyingTo: ChatMessage | null = $state(null);
	/** Users picked from the suggestions for the current draft; sent as `<@id>`. */
	let picked: ChatUser[] = [];
	let mention = $state<{ start: number; query: string } | null>(null);
	let mentionIndex = $state(0);
	let actionError = $state('');
	let highlighted: string | null = $state(null);

	const suggestions = $derived(mention ? suggestMentions(mentionable, mention.query, meId) : []);

	const canAttach = $derived(canSend && uploadTarget !== undefined);
	const uploading = $derived(uploads.some((u) => u.status === 'uploading'));
	const finished = $derived(uploads.filter((u) => u.status === 'done'));
	const canSubmit = $derived(
		!sending && !uploading && (content.trim() !== '' || finished.length > 0)
	);

	const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
	const dayFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

	onMount(() => {
		mounted = true;
		scrollToBottom();
		document.addEventListener('visibilitychange', markRead);
		return () => document.removeEventListener('visibilitychange', markRead);
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
			if (event.type === 'message.created') receive(event.message);
		});
		source.addEventListener('reaction.changed', (e) => {
			const event = JSON.parse((e as MessageEvent<string>).data) as ChannelEvent;
			if (event.type === 'reaction.changed') {
				messages = setReactions(messages, event.messageId, event.reactions);
			}
		});

		return () => source.close();
	});

	/** Posts to one of the page's form actions, e.g. `react`, without a form. */
	async function postAction(action: string, fields: Record<string, string>) {
		const body = new FormData();
		for (const [key, value] of Object.entries(fields)) body.set(key, value);
		const response = await fetch(`?/${action}`, {
			method: 'POST',
			body,
			headers: { accept: 'application/json', 'x-sveltekit-action': 'true' }
		});
		return deserialize(await response.text());
	}

	async function react(messageId: string, emoji: string) {
		actionError = '';
		const result = await postAction('react', { messageId, emoji });
		if (result.type === 'success' && result.data) {
			messages = setReactions(messages, messageId, result.data.reactions as Reaction[]);
		} else if (result.type === 'failure') {
			actionError = String(result.data?.error ?? 'Could not add the reaction.');
		}
	}

	// Reading: the latest message counts as read while the chat is open and the page is visible.
	let lastRead = '';
	function markRead() {
		const last = messages.at(-1);
		if (!last || last.id === lastRead || document.visibilityState !== 'visible') return;
		lastRead = last.id;
		onread?.();
		postAction('read', { messageId: last.id }).catch(() => (lastRead = ''));
	}

	$effect(() => {
		void messages;
		untrack(markRead);
	});

	function startReply(message: ChatMessage) {
		replyingTo = message;
		textarea?.focus();
	}

	/** Scrolls to a message, e.g. the one a reply answers, and highlights it for a moment. */
	function jumpTo(messageId: string) {
		const target = document.getElementById(`message-${messageId}`);
		if (!target) return;
		target.scrollIntoView({ block: 'center', behavior: 'smooth' });
		highlighted = messageId;
		setTimeout(() => {
			if (highlighted === messageId) highlighted = null;
		}, 1500);
	}

	/** Looks for an `@name` being typed right before the caret. */
	function updateMention() {
		if (!textarea || mentionable.length === 0) return;
		const next = activeMention(content.slice(0, textarea.selectionStart));
		if (next?.query !== mention?.query || next?.start !== mention?.start) mentionIndex = 0;
		mention = next;
	}

	async function pickMention(user: ChatUser) {
		if (!mention || !textarea) return;
		const caret = textarea.selectionStart;
		const insert = `@${user.name} `;
		content = content.slice(0, mention.start) + insert + content.slice(caret);
		picked.push(user);
		const position = mention.start + insert.length;
		mention = null;
		await tick();
		textarea.focus();
		textarea.setSelectionRange(position, position);
	}

	/** Show the author line when the author changes, more than 5 minutes passed or it is a reply. */
	function startsGroup(index: number) {
		if (index === 0) return true;
		const prev = messages[index - 1];
		const current = messages[index];
		if (current.replyTo) return true;
		const gap = Date.parse(current.createdAt) - Date.parse(prev.createdAt);
		return prev.author.id !== current.author.id || gap > 5 * 60_000;
	}

	function onKeydown(event: KeyboardEvent) {
		if (suggestions.length > 0) {
			if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
				event.preventDefault();
				const step = event.key === 'ArrowDown' ? 1 : -1;
				mentionIndex = (mentionIndex + step + suggestions.length) % suggestions.length;
				return;
			}
			if ((event.key === 'Enter' || event.key === 'Tab') && !event.isComposing) {
				event.preventDefault();
				pickMention(suggestions[mentionIndex]);
				return;
			}
			if (event.key === 'Escape') {
				event.preventDefault();
				mention = null;
				return;
			}
		}
		if (event.key === 'Escape' && replyingTo) {
			event.preventDefault();
			replyingTo = null;
			return;
		}
		// Enter sends, Shift+Enter adds a line break.
		if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
			event.preventDefault();
			if (canSubmit) (event.currentTarget as HTMLTextAreaElement).form?.requestSubmit();
		}
	}

	function addFiles(files: Iterable<File>) {
		if (!canAttach || !uploadTarget) return;
		uploadError = '';
		for (const file of files) {
			if (uploads.length >= MAX_ATTACHMENTS_PER_MESSAGE) {
				uploadError = `You can send up to ${MAX_ATTACHMENTS_PER_MESSAGE} files at once.`;
				break;
			}
			const problem = checkFile(file, maxUploadSize);
			if (problem) {
				uploadError = problem;
				continue;
			}
			const upload = new PendingUpload(file, uploadTarget);
			uploads.push(upload);
			upload.start();
		}
	}

	function removeUpload(upload: PendingUpload) {
		upload.cancel();
		uploads = uploads.filter((u) => u !== upload);
	}

	function clearUploads() {
		for (const upload of uploads) upload.dispose();
		uploads = [];
	}

	// Unsent files belong to the chat they were picked in: drop them when the chat changes or closes.
	$effect(() => {
		void uploadTarget;
		return () => {
			for (const upload of untrack(() => uploads)) upload.cancel();
			uploads = [];
			uploadError = '';
		};
	});

	function onPaste(event: ClipboardEvent) {
		const files = event.clipboardData?.files;
		if (canAttach && files && files.length > 0) {
			event.preventDefault();
			addFiles(files);
		}
	}

	function hasFiles(event: DragEvent) {
		return event.dataTransfer?.types.includes('Files') ?? false;
	}

	function onDragOver(event: DragEvent) {
		if (!canAttach || !hasFiles(event)) return;
		event.preventDefault();
		dragging = true;
	}

	function onDragLeave(event: DragEvent) {
		// Only when the pointer leaves the chat, not when it moves between its children.
		const next = event.relatedTarget as Node | null;
		if (!next || !(event.currentTarget as HTMLElement).contains(next)) dragging = false;
	}

	function onDrop(event: DragEvent) {
		if (!canAttach || !hasFiles(event)) return;
		event.preventDefault();
		dragging = false;
		addFiles(event.dataTransfer?.files ?? []);
	}
</script>

<section
	class="relative flex min-h-0 flex-1 flex-col"
	aria-label="Chat"
	ondragover={onDragOver}
	ondragleave={onDragLeave}
	ondrop={onDrop}
>
	{#if dragging}
		<div
			class="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-background/90 text-sm font-medium"
		>
			Drop files to share them in {label}
		</div>
	{/if}
	<ol
		bind:this={list}
		class="flex min-h-0 flex-1 flex-col overflow-y-auto py-4"
		aria-label="Messages"
	>
		{#if messages.length === 0}
			<li class="m-auto px-4 text-center text-sm text-muted-foreground">{emptyText}</li>
		{/if}
		{#each messages as message, i (message.id)}
			{@const mentionsMe = meId !== undefined && message.mentions.some((u) => u.id === meId)}
			<!-- Tapping a message focuses it, which shows its actions on touch screens. -->
			<li
				id="message-{message.id}"
				data-mentions-me={mentionsMe}
				tabindex="-1"
				aria-label="Message from {message.author.name}"
				class={cn(
					'group relative border-l-2 border-transparent px-4 outline-none focus-within:bg-muted/40 hover:bg-muted/40',
					startsGroup(i) && 'mt-3 pt-1',
					mentionsMe && 'border-amber-500 bg-amber-500/10 hover:bg-amber-500/15',
					highlighted === message.id && 'bg-primary/10'
				)}
			>
				{#if message.replyTo}
					{@const reply = message.replyTo}
					<button
						type="button"
						class="flex max-w-full min-w-0 items-center gap-1 pt-0.5 text-xs text-muted-foreground hover:text-foreground"
						title="Jump to the message"
						onclick={() => jumpTo(reply.id)}
					>
						<CornerUpLeft class="size-3 shrink-0" />
						<span class="shrink-0 font-semibold">@{reply.author.name}</span>
						<span class="truncate">
							{contentToText(reply.content, reply.mentions) || 'Sent a file'}
						</span>
					</button>
				{/if}
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
				{#if message.content}
					<MessageContent content={message.content} mentions={message.mentions} {meId} />
				{/if}
				{#if message.attachments.length > 0}
					<ul class="grid gap-2 py-1" aria-label="Files">
						{#each message.attachments as attachment (attachment.id)}
							<li class="min-w-0"><AttachmentView {attachment} /></li>
						{/each}
					</ul>
				{/if}
				{#if message.reactions.length > 0}
					<ReactionBar
						reactions={message.reactions}
						{meId}
						{canReact}
						ontoggle={(emoji) => react(message.id, emoji)}
					/>
				{/if}
				{#if canReact || canSend}
					<div
						class="pointer-events-none absolute -top-4 right-3 z-10 flex rounded-md border bg-background p-0.5 opacity-0 shadow-sm group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 has-data-[state=open]:pointer-events-auto has-data-[state=open]:opacity-100"
						role="toolbar"
						aria-label="Message actions"
					>
						{#if canReact}
							<EmojiPicker onpick={(emoji) => react(message.id, emoji)} />
						{/if}
						{#if canSend}
							<Button
								variant="ghost"
								size="icon"
								class="size-7"
								aria-label="Reply"
								onclick={() => startReply(message)}
							>
								<Reply class="size-4" />
							</Button>
						{/if}
					</div>
				{/if}
			</li>
		{/each}
	</ol>

	<footer class="shrink-0 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
		{#if actionError}
			<p class="pb-2 text-sm text-destructive" role="alert">{actionError}</p>
		{/if}
		{#if canSend}
			{#if suggestions.length > 0}
				<MentionSuggestions
					id="mention-suggestions"
					users={suggestions}
					active={mentionIndex}
					onpick={pickMention}
				/>
			{/if}
			{#if replyingTo}
				<div class="flex items-center gap-2 pb-2 text-sm text-muted-foreground">
					<CornerUpLeft class="size-4 shrink-0" />
					<span class="min-w-0 flex-1 truncate">
						Replying to <span class="font-semibold text-foreground">{replyingTo.author.name}</span>
					</span>
					<Button
						variant="ghost"
						size="icon"
						class="size-6"
						aria-label="Cancel reply"
						onclick={() => (replyingTo = null)}
					>
						<X class="size-3.5" />
					</Button>
				</div>
			{/if}
			{#if uploads.length > 0}
				<ul class="-mt-1 flex gap-2 overflow-x-auto pt-3 pr-2 pb-2" aria-label="Files to send">
					{#each uploads as upload (upload.key)}
						<li
							class="relative flex w-44 shrink-0 flex-col gap-1.5 rounded-md border p-2"
							aria-label={upload.file.name}
						>
							<div class="flex items-center gap-2">
								{#if upload.previewUrl}
									<img
										src={upload.previewUrl}
										alt=""
										class="size-8 shrink-0 rounded object-cover"
									/>
								{:else}
									<FileText class="size-8 shrink-0 text-muted-foreground" />
								{/if}
								<span class="min-w-0 flex-1">
									<span class="block truncate text-xs font-medium">{upload.file.name}</span>
									<span class="block text-xs text-muted-foreground">
										{#if upload.status === 'failed'}
											<span class="text-destructive">{upload.error}</span>
										{:else if upload.status === 'done'}
											{formatBytes(upload.file.size)}
										{:else}
											{Math.floor(upload.progress * 100)}% of {formatBytes(upload.file.size)}
										{/if}
									</span>
								</span>
							</div>
							{#if upload.status === 'uploading'}
								<Progress value={upload.progress * 100} aria-label="Uploading {upload.file.name}" />
							{/if}
							<div class="absolute -top-2 -right-2 flex gap-1">
								{#if upload.status === 'failed'}
									<Button
										variant="secondary"
										size="icon"
										class="size-6 rounded-full border"
										aria-label="Retry {upload.file.name}"
										onclick={() => upload.retry()}
									>
										<RotateCw class="size-3" />
									</Button>
								{/if}
								<Button
									variant="secondary"
									size="icon"
									class="size-6 rounded-full border"
									aria-label="Remove {upload.file.name}"
									onclick={() => removeUpload(upload)}
								>
									<X class="size-3" />
								</Button>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
			<form
				method="post"
				action="?/send"
				class="flex items-end gap-2"
				use:enhance={({ cancel, formData }) => {
					if (!canSubmit) return cancel();
					formData.set('content', encodeMentions(content, picked));
					sending = true;
					return async ({ result, update }) => {
						sending = false;
						if (result.type === 'success' && result.data?.message) {
							content = '';
							picked = [];
							replyingTo = null;
							mention = null;
							clearUploads();
							await receive(result.data.message as ChatMessage);
							await scrollToBottom();
						} else {
							await update({ reset: false, invalidateAll: false });
						}
					};
				}}
			>
				{#if replyingTo}
					<input type="hidden" name="replyTo" value={replyingTo.id} />
				{/if}
				{#each finished as upload (upload.key)}
					<input type="hidden" name="attachment" value={upload.id} />
				{/each}
				{#if canAttach}
					<input
						bind:this={fileInput}
						type="file"
						multiple
						class="hidden"
						aria-label="Choose files"
						onchange={(e) => {
							addFiles(e.currentTarget.files ?? []);
							e.currentTarget.value = '';
						}}
					/>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label="Attach files"
						title={maxUploadSize ? `Share files up to ${formatBytes(maxUploadSize)}` : undefined}
						onclick={() => fileInput?.click()}
					>
						<Paperclip />
					</Button>
				{/if}
				<Textarea
					name="content"
					bind:ref={textarea}
					bind:value={content}
					onkeydown={onKeydown}
					oninput={updateMention}
					onclick={updateMention}
					onkeyup={(e) => {
						if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) updateMention();
					}}
					onblur={() => (mention = null)}
					onpaste={onPaste}
					rows={1}
					maxlength={MAX_MESSAGE_LENGTH}
					placeholder="Message {label}"
					aria-label="Message {label}"
					class="max-h-40 min-h-9 flex-1 resize-none"
				/>
				<Button type="submit" size="icon" disabled={!canSubmit} aria-label="Send">
					<SendHorizontal />
				</Button>
			</form>
			{#if uploadError || error}
				<p class="pt-2 text-sm text-destructive" role="alert">{uploadError || error}</p>
			{/if}
		{:else}
			<p class="text-center text-sm text-muted-foreground">{cannotSendText}</p>
		{/if}
	</footer>
</section>
