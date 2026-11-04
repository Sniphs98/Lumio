import { describe, expect, it } from 'vitest';
import {
	isSocialProvider,
	providerList,
	SOCIAL_ERRORS,
	socialErrorFromUrl,
	socialErrorMessage,
	withProvider
} from './social.ts';

describe('socialErrorMessage', () => {
	it('has no message without an error', () => {
		expect(socialErrorMessage(null, 'discord')).toBeNull();
		expect(socialErrorMessage('', 'google')).toBeNull();
	});

	it('explains known errors and names the service', () => {
		expect(socialErrorMessage(SOCIAL_ERRORS.notAdmitted, 'steam')).toMatch(
			/invite link.*continue with Steam/
		);
		expect(socialErrorMessage(SOCIAL_ERRORS.banned, 'google')).toBe(
			'You are banned from this Lumio.'
		);
		expect(socialErrorMessage('account_not_linked', 'discord')).toMatch(/connect Discord/);
		expect(socialErrorMessage('account_already_linked_to_different_user', 'google')).toMatch(
			/That account on Google is already connected/
		);
	});

	it('never shows text from the link', () => {
		expect(socialErrorMessage('Your account is locked, call 555-0100', 'google')).toBe(
			'Signing in with Google did not work. Please try again.'
		);
		expect(socialErrorMessage('Call 555-0100', 'Evil Corp')).toBe(
			'Signing in did not work. Please try again.'
		);
		expect(socialErrorMessage(SOCIAL_ERRORS.invalidName, '555-0100')).toBe(
			'Your name on the other service cannot be used here.'
		);
	});

	it('reads the error and the service from a URL', () => {
		const url = new URL('https://lumio.example/login?error=access_denied&via=steam');
		expect(socialErrorFromUrl(url)).toBe('You cancelled signing in with Steam.');
	});
});

describe('withProvider', () => {
	it('adds the service to paths with and without a query', () => {
		expect(withProvider('/login', 'google')).toBe('/login?via=google');
		expect(withProvider('/login?redirectTo=%2Fchannels', 'steam')).toBe(
			'/login?redirectTo=%2Fchannels&via=steam'
		);
	});
});

describe('isSocialProvider', () => {
	it('only accepts known services', () => {
		expect(isSocialProvider('discord')).toBe(true);
		expect(isSocialProvider('credential')).toBe(false);
		expect(isSocialProvider(undefined)).toBe(false);
	});
});

describe('providerList', () => {
	it('lists the services for a sentence', () => {
		expect(providerList([])).toBe('');
		expect(providerList(['steam'])).toBe('Steam');
		expect(providerList(['discord', 'google'])).toBe('Discord or Google');
		expect(providerList(['discord', 'google', 'steam'])).toBe('Discord, Google or Steam');
	});
});
