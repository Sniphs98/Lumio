<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { FileText, Paperclip, RotateCw, SendHorizontal, X } from '@lucide/svelte';
	import { onMount, tick, untrack } from 'svelte';
	import { formatBytes, MAX_ATTACHMENTS_PER_MESSAGE } from '#lib/attachments.ts';
	import AttachmentView from '#lib/components/chat/attachment-view.svelte';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Progress } from '#lib/components/ui/progress/index.ts';
	import {
		addMessage,
		MAX_MESSAGE_LENGTH,
		type ChannelEvent,
		type ChatMessage
	} from '#lib/chat.ts';
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
		maxUploadSize = 0
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
				{#if message.content}
					<p class="text-sm break-words whitespace-pre-wrap">{message.content}</p>
				{/if}
				{#if message.attachments.length > 0}
					<ul class="grid gap-2 py-1" aria-label="Files">
						{#each message.attachments as attachment (attachment.id)}
							<li class="min-w-0"><AttachmentView {attachment} /></li>
						{/each}
					</ul>
				{/if}
			</li>
		{/each}
	</ol>

	<footer class="shrink-0 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
		{#if canSend}
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
				use:enhance={({ cancel }) => {
					if (!canSubmit) return cancel();
					sending = true;
					return async ({ result, update }) => {
						sending = false;
						if (result.type === 'success' && result.data?.message) {
							content = '';
							clearUploads();
							await receive(result.data.message as ChatMessage);
							await scrollToBottom();
						} else {
							await update({ reset: false, invalidateAll: false });
						}
					};
				}}
			>
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
				<textarea
					name="content"
					bind:value={content}
					onkeydown={onKeydown}
					onpaste={onPaste}
					rows="1"
					maxlength={MAX_MESSAGE_LENGTH}
					placeholder="Message {label}"
					aria-label="Message {label}"
					class="field-sizing-content max-h-40 min-h-9 flex-1 resize-none rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
				></textarea>
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
