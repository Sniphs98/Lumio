import { defineEnvVars } from '@sveltejs/kit/env';

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
	LIVEKIT_API_SECRET: { description: 'LiveKit API secret, must match the LiveKit server config.' }
});
