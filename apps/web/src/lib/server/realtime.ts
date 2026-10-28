import { EventEmitter } from 'node:events';
import type { RealtimeEvent } from '#lib/chat.ts';

// In-process pub/sub. Enough for a single app container; when Lumio runs several
// app processes this gets replaced by Valkey pub/sub behind the same two functions.
const hub = new EventEmitter();
hub.setMaxListeners(0);

/**
 * Topics are channel ids, conversation ids, or `userTopic(id)` for events meant for one user.
 */
export function publish(topic: string, event: RealtimeEvent): void {
	hub.emit(topic, event);
}

/** Subscribes to a topic's events and returns the unsubscribe function. */
export function subscribe(topic: string, listener: (event: RealtimeEvent) => void): () => void {
	hub.on(topic, listener);
	return () => hub.off(topic, listener);
}

export function userTopic(userId: string): string {
	return `user:${userId}`;
}
