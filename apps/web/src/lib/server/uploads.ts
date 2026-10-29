import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { DeleteObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { FileStore } from '@tus/file-store';
import { S3Store } from '@tus/s3-store';
import { Server, type DataStore } from '@tus/server';
import {
	S3_ACCESS_KEY_ID,
	S3_BUCKET,
	S3_ENDPOINT,
	S3_REGION,
	S3_SECRET_ACCESS_KEY,
	UPLOAD_DIR
} from '$app/env/private';
import {
	fitsQuota,
	formatBytes,
	parseUploadTarget,
	sanitizeFileName,
	sanitizeMimeType
} from '#lib/attachments.ts';
import {
	canUploadTo,
	createAttachment,
	deleteUnsentAttachments,
	getMaxUploadSize,
	getStorage
} from '#lib/server/attachments.ts';

/** Route of the resumable upload endpoint (tus protocol). */
export const UPLOAD_PATH = '/api/uploads';

/** Unfinished uploads and files that were never sent are deleted after a day. */
const UPLOAD_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * Where shared files live: a folder on the instance by default, or an S3 bucket when `S3_BUCKET`
 * is set. In both, a finished file is stored under its attachment id.
 */
type Storage = {
	datastore: DataStore;
	/** Reads a finished file, optionally only the bytes `start` to `end` (inclusive). */
	read(id: string, range?: { start: number; end: number }): Promise<ReadableStream<Uint8Array>>;
	remove(id: string): Promise<void>;
};

function fileStorage(directory: string): Storage {
	const root = resolve(directory);
	const datastore = new FileStore({
		directory: root,
		expirationPeriodInMilliseconds: UPLOAD_EXPIRY_MS
	});
	return {
		datastore,
		async read(id, range) {
			const stream = createReadStream(join(root, id), range);
			return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
		},
		remove: (id) => datastore.remove(id)
	};
}

function s3Storage(bucket: string): Storage {
	const config = {
		region: S3_REGION ?? 'auto',
		endpoint: S3_ENDPOINT,
		// Most self-hosted S3 services (MinIO, Garage) need path-style URLs.
		forcePathStyle: S3_ENDPOINT !== undefined,
		credentials:
			S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY
				? { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY }
				: undefined
	};
	const client = new S3Client(config);
	const datastore = new S3Store({
		s3ClientConfig: { ...config, bucket },
		expirationPeriodInMilliseconds: UPLOAD_EXPIRY_MS
	});
	return {
		datastore,
		async read(id, range) {
			const object = await client.send(
				new GetObjectCommand({
					Bucket: bucket,
					Key: id,
					Range: range ? `bytes=${range.start}-${range.end}` : undefined
				})
			);
			if (!object.Body) throw new Error(`File ${id} is empty`);
			return object.Body.transformToWebStream() as ReadableStream<Uint8Array>;
		},
		async remove(id) {
			await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: id }));
			await datastore.remove(id).catch(() => {});
		}
	};
}

export const storage: Storage = S3_BUCKET ? s3Storage(S3_BUCKET) : fileStorage(UPLOAD_DIR);

/** The signed-in user of the upload request being handled, for the tus hooks below. */
const currentUser = new AsyncLocalStorage<{ id: string }>();

class UploadError {
	constructor(
		readonly status_code: number,
		readonly body: string
	) {}
}

const tus = new Server({
	path: UPLOAD_PATH,
	datastore: storage.datastore,
	relativeLocation: true,
	disableTerminationForFinishedUploads: true,
	namingFunction: () => randomUUID(),
	maxSize: () => getMaxUploadSize(),

	async onUploadCreate(_req, upload) {
		const user = currentUser.getStore();
		if (!user) throw new UploadError(401, 'Not signed in');
		if (upload.sizeIsDeferred) throw new UploadError(400, 'The file size is missing');

		const target = parseUploadTarget(upload.metadata?.target);
		if (!target || !(await canUploadTo(user.id, target))) {
			throw new UploadError(403, 'You cannot share files in this chat.');
		}
		// Storage per person. Uploads still in progress are not counted yet.
		const usage = await getStorage(user.id);
		if (!fitsQuota(usage.used, upload.size ?? 0, usage.quota)) {
			throw new UploadError(
				403,
				`You have shared ${formatBytes(usage.used)} of your ${formatBytes(usage.quota ?? 0)}. Delete messages with files you sent to free up space.`
			);
		}
		return {
			metadata: {
				target: upload.metadata!.target,
				filename: sanitizeFileName(upload.metadata?.filename),
				filetype: sanitizeMimeType(upload.metadata?.filetype),
				uploaderId: user.id
			}
		};
	},

	async onIncomingRequest(req, id) {
		// Only the uploader may continue, inspect or cancel an upload.
		if (req.method === 'POST') return;
		const user = currentUser.getStore();
		const upload = await storage.datastore.getUpload(id).catch(() => null);
		if (!user || !upload || upload.metadata?.uploaderId !== user.id) {
			throw new UploadError(404, 'Upload not found');
		}
	},

	async onUploadFinish(_req, upload) {
		const metadata = upload.metadata ?? {};
		const target = parseUploadTarget(metadata.target);
		if (!target || !metadata.uploaderId) throw new UploadError(400, 'Upload metadata is missing');
		await createAttachment({
			id: upload.id,
			uploaderId: metadata.uploaderId,
			target,
			fileName: sanitizeFileName(metadata.filename),
			mimeType: sanitizeMimeType(metadata.filetype),
			size: upload.size ?? upload.offset
		});
		return {};
	}
});

/** Handles a request of the tus upload protocol for a signed-in user. */
export function handleUpload(request: Request, userId: string): Promise<Response> {
	return currentUser.run({ id: userId }, () => tus.handleWeb(request));
}

/** Deletes unfinished uploads and files that were never sent. */
export async function cleanUpUploads(): Promise<void> {
	await tus.cleanUpExpiredUploads().catch(() => 0);
	const ids = await deleteUnsentAttachments(new Date(Date.now() - UPLOAD_EXPIRY_MS));
	for (const id of ids) await storage.remove(id).catch(() => {});
}
