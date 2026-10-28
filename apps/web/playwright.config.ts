import { defineConfig } from '@playwright/test';

// Needs Postgres (docker-compose.dev.yml) and a migrated database.
export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.e2e.ts',
	webServer: {
		command: 'pnpm build && pnpm preview',
		port: 4173,
		reuseExistingServer: !process.env.CI
	},
	use: {
		baseURL: 'http://localhost:4173',
		// PW_CHROMIUM_PATH lets you use an already installed Chromium.
		launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH }
	}
});
