<script lang="ts">
	import { resolve } from '$app/paths';
	import { Download, FileText } from '@lucide/svelte';
	import { formatBytes, previewKind, type Attachment } from '#lib/attachments.ts';

	let { attachment }: { attachment: Attachment } = $props();

	const kind = $derived(previewKind(attachment.mimeType));
	const url = $derived(
		resolve('/api/attachments/[id]/[name]', {
			id: attachment.id,
			name: encodeURIComponent(attachment.fileName)
		})
	);
</script>

{#if kind === 'image'}
	<a
		href={url}
		target="_blank"
		rel="noopener"
		class="block w-fit max-w-full overflow-hidden rounded-md border"
	>
		<img
			src={url}
			alt={attachment.fileName}
			loading="lazy"
			class="max-h-80 w-auto max-w-full object-contain"
		/>
	</a>
{:else if kind === 'video'}
	<!-- svelte-ignore a11y_media_has_caption -->
	<video
		src={url}
		controls
		preload="metadata"
		playsinline
		aria-label={attachment.fileName}
		class="max-h-96 w-full max-w-xl rounded-md border bg-black"
	></video>
{:else if kind === 'audio'}
	<div class="grid w-full max-w-sm gap-1 rounded-md border p-2">
		<span class="truncate text-sm">{attachment.fileName}</span>
		<audio src={url} controls preload="metadata" class="w-full"></audio>
	</div>
{/if}

{#if kind === 'file' || kind === 'video'}
	<a
		href={url}
		download={attachment.fileName}
		class="flex w-full max-w-sm items-center gap-3 rounded-md border p-2 hover:bg-muted {kind ===
		'video'
			? 'mt-1 border-transparent py-0'
			: ''}"
		aria-label="Download {attachment.fileName}"
	>
		{#if kind === 'file'}
			<FileText class="size-8 shrink-0 text-muted-foreground" />
		{/if}
		<span class="min-w-0 flex-1">
			<span class="block truncate text-sm font-medium">{attachment.fileName}</span>
			<span class="block text-xs text-muted-foreground">{formatBytes(attachment.size)}</span>
		</span>
		<Download class="size-4 shrink-0 text-muted-foreground" />
	</a>
{/if}
