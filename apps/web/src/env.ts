import { defineEnvVars } from '@sveltejs/kit/env';

/** Optional variables: unset or empty means `undefined`. */
const optional = (value: string | undefined) => value?.trim() || undefined;

export const variables = defineEnvVars({
	DATABASE_URL: { description: 'The database connection string.' },
	ORIGIN: {
		description: 'The app origin (base URL), e.g. `http://localhost:5173`.'
	},
	BETTER_AUTH_SECRET: {
		description:
			'Secret used to sign tokens. For production use 32 characters generated with high entropy. See [Better Auth installation](https://www.better-auth.com/docs/installation).'
	},
	LIVEKIT_URL: {
		description: 'Public WebSocket URL of the LiveKit server, e.g. `wss://rtc.example.com`.'
	},
	LIVEKIT_API_KEY: { description: 'LiveKit API key, must match the LiveKit server config.' },
	LIVEKIT_API_SECRET: { description: 'LiveKit API secret, must match the LiveKit server config.' },
	UPLOAD_DIR: {
		description:
			'Folder for files shared in chats, used when no S3 bucket is configured. Defaults to `data/uploads`.',
		schema: (value) => value?.trim() || 'data/uploads'
	},
	S3_BUCKET: {
		description: 'Optional S3 bucket for shared files. When set, files are stored there instead.',
		schema: optional
	},
	S3_REGION: { description: 'Region of the S3 bucket. Defaults to `auto`.', schema: optional },
	S3_ENDPOINT: {
		description: 'Endpoint of an S3-compatible service, e.g. MinIO or Cloudflare R2.',
		schema: optional
	},
	S3_ACCESS_KEY_ID: { description: 'Access key for the S3 bucket.', schema: optional },
	S3_SECRET_ACCESS_KEY: { description: 'Secret key for the S3 bucket.', schema: optional }
});
