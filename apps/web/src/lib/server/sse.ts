import type { RealtimeEvent } from '#lib/chat.ts';
import { subscribe } from '#lib/server/realtime.ts';

const HEARTBEAT_MS = 25_000;

/**
 * Server-Sent Events response that forwards every event published to `topic`.
 * The browser's EventSource reconnects on its own; pages reload their data after a
 * reconnect to fill any gap, unless the stream starts with the current state (`initial`).
 * The stream ends without forwarding the event when `until` returns true for it, e.g. when
 * the user lost access to the topic.
 */
export function eventStream(
	topic: string,
	request: Request,
	options: {
		/** Events sent first, e.g. the current state. Topic events wait until they are sent. */
		initial?: () => Promise<RealtimeEvent[]>;
		/** Leaves out topic events this client may not see. */
		filter?: (event: RealtimeEvent) => boolean;
		/** Ends the stream instead of sending this event. */
		until?: (event: RealtimeEvent) => boolean;
		/** Called once when the client goes away. */
		onClose?: () => void;
	} = {}
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

			const sendEvent = (event: RealtimeEvent) =>
				send(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);

			const close = () => {
				cleanup();
				try {
					controller.close();
				} catch {
					// already closed
				}
			};

			send('retry: 3000\n\n');
			// Subscribe before reading the initial state, so no change in between is lost.
			let queue: RealtimeEvent[] | null = options.initial ? [] : null;
			const unsubscribe = subscribe(topic, (event) => {
				if (options.until?.(event)) return close();
				if (options.filter && !options.filter(event)) return;
				if (queue) queue.push(event);
				else sendEvent(event);
			});
			if (options.initial) {
				const flush = (events: RealtimeEvent[]) => {
					const queued = queue ?? [];
					queue = null;
					for (const event of [...events, ...queued]) sendEvent(event);
				};
				options.initial().then(flush, () => flush([]));
			}
			const heartbeat = setInterval(() => send(': ping\n\n'), HEARTBEAT_MS);

			let closed = false;
			cleanup = () => {
				if (closed) return;
				closed = true;
				clearInterval(heartbeat);
				unsubscribe();
				options.onClose?.();
			};
			if (request.signal.aborted) cleanup();
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
