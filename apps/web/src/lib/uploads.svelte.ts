import { DetailedError, Upload } from 'tus-js-client';
import { formatBytes, UPLOAD_CHUNK_SIZE } from '#lib/attachments.ts';

export type UploadStatus = 'uploading' | 'done' | 'failed';

/**
 * A file being shared in the composer. It is uploaded in pieces with the tus protocol, so a
 * dropped connection is retried and resumes where it stopped, also after a page reload when the
 * same file is picked again for the same chat.
 */
export class PendingUpload {
	readonly key = crypto.randomUUID();
	readonly file: File;
	status: UploadStatus = $state('uploading');
	/** Bytes the server has received. */
	sent = $state(0);
	/** Attachment id, set once the upload is finished. */
	id: string | null = $state(null);
	error: string | null = $state(null);
	/** Local preview of an image, revoked by `dispose`. */
	readonly previewUrl: string | null;

	#upload: Upload;

	constructor(file: File, target: string) {
		this.file = file;
		this.previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
		this.#upload = new Upload(file, {
			endpoint: '/api/uploads/',
			chunkSize: UPLOAD_CHUNK_SIZE,
			retryDelays: [0, 1000, 3000, 5000, 10000, 20000],
			metadata: { filename: file.name, filetype: file.type, target },
			// Resuming must stay within one chat: a file uploaded for another chat cannot be sent here.
			fingerprint: async (f) =>
				['lumio', target, f.name, f.type, f.size, (f as File).lastModified].join('|'),
			removeFingerprintOnSuccess: true,
			onProgress: (sent) => {
				this.sent = sent;
			},
			onSuccess: () => {
				this.sent = file.size;
				this.id = this.#upload.url?.split('/').pop() ?? null;
				this.status = this.id ? 'done' : 'failed';
			},
			onError: (err) => {
				this.status = 'failed';
				this.error = uploadErrorText(err);
			}
		});
	}

	get progress(): number {
		return this.file.size === 0 ? 1 : this.sent / this.file.size;
	}

	async start() {
		const previous = await this.#upload.findPreviousUploads().catch(() => []);
		if (previous.length > 0) this.#upload.resumeFromPreviousUpload(previous[0]);
		this.#upload.start();
	}

	retry() {
		this.status = 'uploading';
		this.error = null;
		this.#upload.start();
	}

	/** Stops the upload and deletes what arrived so far, unless it already finished. */
	cancel() {
		if (this.status === 'uploading') this.#upload.abort(true).catch(() => {});
		this.dispose();
	}

	dispose() {
		if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
	}
}

function uploadErrorText(err: Error): string {
	const status = err instanceof DetailedError ? err.originalResponse?.getStatus() : undefined;
	if (status === 413) return 'The file is too large.';
	if (status === 403) return 'You cannot share files here.';
	return 'Upload failed.';
}

/** Checks a picked file before uploading it. Returns an error text, or null if it may be sent. */
export function checkFile(file: File, maxUploadSize: number): string | null {
	if (file.size > maxUploadSize) {
		return `${file.name} is larger than ${formatBytes(maxUploadSize)}.`;
	}
	return null;
}
