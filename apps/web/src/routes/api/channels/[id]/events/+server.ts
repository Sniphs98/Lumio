import { error } from '@sveltejs/kit';
import type { ChannelEvent } from '#lib/chat.ts';
import { hasPermission, Permission } from '#lib/permissions.ts';
import { getChannel, getChannelPermissions } from '#lib/server/channels.ts';
import { subscribe } from '#lib/server/realtime.ts';
import type { RequestHandler } from './$types';

const HEARTBEAT_MS = 25_000;

/**
 * Server-Sent Events stream of a channel. The browser's EventSource reconnects on its own,
 * and the page reloads the message history after a reconnect to fill any gap.
 */
export const GET: RequestHandler = async ({ params, locals, request }) => {
	if (!locals.user) error(401, 'Not signed in');

	const channel = await getChannel(params.id).catch(() => null);
	if (!channel || channel.type !== 'text') error(404, 'Channel not found');
	const permissions = await getChannelPermissions(locals.user.id, channel.id);
	if (!hasPermission(permissions, Permission.ViewChannel)) error(404, 'Channel not found');

	const encoder = new TextEncoder();
	let cleanup = () => {};

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			const send = (chunk: string) => {
				try {
					controller.enqueue(encoder.encode(chunk));
				} catch {
					cleanup();
				}
			};

			send('retry: 3000\n\n');
			const unsubscribe = subscribe(channel.id, (event: ChannelEvent) => {
				send(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
			});
			const heartbeat = setInterval(() => send(': ping\n\n'), HEARTBEAT_MS);

			cleanup = () => {
				clearInterval(heartbeat);
				unsubscribe();
			};
			request.signal.addEventListener('abort', () => {
				cleanup();
				try {
					controller.close();
				} catch {
					// already closed
				}
			});
		},
		cancel() {
			cleanup();
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-cache, no-transform',
			connection: 'keep-alive',
			'x-accel-buffering': 'no'
		}
	});
};
