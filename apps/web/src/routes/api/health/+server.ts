import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '#lib/server/db/index.ts';
import type { RequestHandler } from './$types';

/**
 * Health check for the Docker `HEALTHCHECK`, reverse proxies and uptime monitors. Answers
 * 200 when the app can reach its database and 503 when it cannot. Needs no sign-in and
 * reveals nothing about the server.
 */
export const GET: RequestHandler = async () => {
	try {
		await db.execute(sql`select 1`);
		return json({ status: 'ok' }, { headers: { 'cache-control': 'no-store' } });
	} catch {
		return json(
			{ status: 'unavailable' },
			{ status: 503, headers: { 'cache-control': 'no-store' } }
		);
	}
};
