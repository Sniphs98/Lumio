import { subscribe } from '#lib/server/realtime.ts';

const HEARTBEAT_MS = 25_000;

/**
 * Server-Sent Events response that forwards every event published to `topic` (or to any of
 * several topics).
 * The browser's EventSource reconnects on its own; pages reload their data after a
 * reconnect to fill any gap.
 */
export function eventStream(topic: string | string[], request: Request): Response {
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
			const unsubscribes = [topic].flat().map((t) =>
				subscribe(t, (event) => {
					send(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
				})
			);
			const heartbeat = setInterval(() => send(': ping\n\n'), HEARTBEAT_MS);

			cleanup = () => {
				clearInterval(heartbeat);
				for (const unsubscribe of unsubscribes) unsubscribe();
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
}
