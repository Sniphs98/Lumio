import { expect, test as setup } from '@playwright/test';
import postgres from 'postgres';
import { E2E_INVITE_CODE, uniqueEmail } from './helpers.ts';

/**
 * Sign-up is invite-only once an instance exists. Before the tests run, this makes sure
 * there is an instance (on an empty database the first account sets it up) and an
 * unlimited invite link that the tests join with.
 */
setup('prepare the instance and a shared invite link', async ({ page }) => {
	const url = process.env.DATABASE_URL;
	if (!url) throw new Error('DATABASE_URL is not set');
	const sql = postgres(url, { max: 1 });

	try {
		const [existing] = await sql`select owner_id from instance where id = 1`;
		if (!existing) {
			await page.goto('/login');
			await page.getByRole('button', { name: 'Register' }).click();
			await page.getByLabel('Display name').fill('Owner');
			await page.getByLabel('Email').fill(uniqueEmail('owner'));
			await page.getByLabel('Password').fill('correct horse battery');
			await page.getByRole('button', { name: 'Create account' }).click();
			await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
		}

		const [{ owner_id: ownerId }] = await sql`select owner_id from instance where id = 1`;
		await sql`
			insert into invite (code, created_by_id, expires_at)
			values (${E2E_INVITE_CODE}, ${ownerId}, now() + interval '1 day')
			on conflict (code) do update set expires_at = excluded.expires_at, max_uses = null
		`;
	} finally {
		await sql.end();
	}
});
