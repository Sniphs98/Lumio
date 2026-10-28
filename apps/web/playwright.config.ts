import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

// Needs Postgres (docker-compose.dev.yml) and a migrated database. The setup project
// connects to it directly, so load DATABASE_URL from .env when it is not set already.
if (!process.env.DATABASE_URL && existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
	testDir: 'e2e',
	projects: [
		{ name: 'setup', testMatch: 'setup.ts' },
		{ name: 'e2e', testMatch: '**/*.e2e.ts', dependencies: ['setup'] }
	],
	webServer: {
		command: 'pnpm build && pnpm preview',
		port: 4173,
		reuseExistingServer: !process.env.CI
	},
	use: {
		baseURL: 'http://localhost:4173',
		launchOptions: {
			// PW_CHROMIUM_PATH lets you use an already installed Chromium.
			executablePath: process.env.PW_CHROMIUM_PATH,
			// Calls use a fake microphone and camera and skip the permission prompt.
			args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
		}
	}
});
