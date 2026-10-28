import { EventEmitter } from 'node:events';
import type { ChannelEvent } from '#lib/chat.ts';

// In-process pub/sub. Enough for a single app container; when Lumio runs several
// app processes this gets replaced by Valkey pub/sub behind the same two functions.
const hub = new EventEmitter();
hub.setMaxListeners(0);

export function publish(channelId: string, event: ChannelEvent): void {
	hub.emit(channelId, event);
}

/** Subscribes to a channel's events and returns the unsubscribe function. */
export function subscribe(channelId: string, listener: (event: ChannelEvent) => void): () => void {
	hub.on(channelId, listener);
	return () => hub.off(channelId, listener);
}
