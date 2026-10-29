import { describe, expect, it } from 'vitest';
import { allowLiveKit, liveKitOrigins } from './csp.ts';

describe('liveKitOrigins', () => {
	it('names the WebSocket and HTTP origin of the LiveKit server', () => {
		expect(liveKitOrigins('wss://rtc.example.com')).toEqual([
			'wss://rtc.example.com',
			'https://rtc.example.com'
		]);
		expect(liveKitOrigins('ws://localhost:7880')).toEqual([
			'ws://localhost:7880',
			'http://localhost:7880'
		]);
		expect(liveKitOrigins('not a url')).toEqual([]);
	});
});

describe('allowLiveKit', () => {
	it('adds the origins to connect-src only', () => {
		expect(
			allowLiveKit("default-src 'self'; connect-src 'self'; img-src 'self'", [
				'wss://rtc.example.com'
			])
		).toBe("default-src 'self'; connect-src 'self' wss://rtc.example.com; img-src 'self'");
	});

	it('leaves policies without connect-src alone', () => {
		expect(allowLiveKit("default-src 'self'", ['wss://rtc.example.com'])).toBe(
			"default-src 'self'"
		);
	});
});
