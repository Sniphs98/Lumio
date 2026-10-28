import type { RealtimeEvent } from '#lib/chat.ts';
import { subscribe } from '#lib/server/realtime.ts';

const HEARTBEAT_MS = 25_000;

/**
 * Server-Sent Events response that forwards every event published to `topic`.
 * The browser's EventSource reconnects on its own; pages reload their data after a
 * reconnect to fill any gap. The stream ends without forwarding the event when `until`
 * returns true for it, e.g. when the user lost access to the topic.
 */
export function eventStream(
	topic: string,
	request: Request,
	{ until }: { until?: (event: RealtimeEvent) => boolean } = {}
): Response {
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

			const close = () => {
				cleanup();
				try {
					controller.close();
				} catch {
					// already closed
				}
			};

			send('retry: 3000\n\n');
			const unsubscribe = subscribe(topic, (event) => {
				if (until?.(event)) close();
				else send(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
			});
			const heartbeat = setInterval(() => send(': ping\n\n'), HEARTBEAT_MS);

			cleanup = () => {
				clearInterval(heartbeat);
				unsubscribe();
			};
			request.signal.addEventListener('abort', close);
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
