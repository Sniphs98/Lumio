import { describe, expect, it } from 'vitest';
import {
	activeMention,
	contentToText,
	encodeMentions,
	parseMentionIds,
	splitContent,
	suggestMentions
} from './mentions.ts';

const anna = { id: 'anna1', name: 'Anna' };
const annaBerg = { id: 'anna2', name: 'Anna Berg' };
const ben = { id: 'ben', name: 'Ben' };

describe('parseMentionIds', () => {
	it('finds every mentioned user once', () => {
		expect(parseMentionIds('hi <@anna1> and <@ben>, <@anna1>!')).toEqual(['anna1', 'ben']);
		expect(parseMentionIds('mail me at a@b.c <@>')).toEqual([]);
	});
});

describe('splitContent', () => {
	it('splits text and mentions', () => {
		expect(splitContent('<@anna1> look at this, <@ben>')).toEqual([
			{ type: 'mention', userId: 'anna1' },
			{ type: 'text', text: ' look at this, ' },
			{ type: 'mention', userId: 'ben' }
		]);
		expect(splitContent('no mentions')).toEqual([{ type: 'text', text: 'no mentions' }]);
	});
});

describe('contentToText', () => {
	it('writes mentions as names', () => {
		expect(contentToText('hey <@ben> and <@gone>', [ben])).toBe('hey @Ben and @unknown');
	});
});

describe('encodeMentions', () => {
	it('turns picked names into tokens, longest name first', () => {
		expect(encodeMentions('@Anna Berg and @Anna, not @Annabel', [anna, annaBerg])).toBe(
			'<@anna2> and <@anna1>, not @Annabel'
		);
	});

	it('leaves names alone that were not picked', () => {
		expect(encodeMentions('@Ben hi', [])).toBe('@Ben hi');
		expect(encodeMentions('@Ben hi @Anna', [ben])).toBe('<@ben> hi @Anna');
	});

	it('handles names with special characters', () => {
		expect(encodeMentions('@a.b (c)? yes', [{ id: 'x', name: 'a.b (c)?' }])).toBe('<@x> yes');
	});
});

describe('activeMention', () => {
	it('finds the @query before the caret', () => {
		expect(activeMention('hello @an')).toEqual({ start: 6, query: 'an' });
		expect(activeMention('@')).toEqual({ start: 0, query: '' });
	});

	it('ignores email addresses and finished words', () => {
		expect(activeMention('mail a@b')).toBeNull();
		expect(activeMention('@anna ')).toBeNull();
	});
});

describe('suggestMentions', () => {
	it('prefers names that start with the query and leaves out the user', () => {
		const users = [ben, annaBerg, anna, { id: 'me', name: 'Andi' }];
		expect(suggestMentions(users, 'an', 'me')).toEqual([anna, annaBerg]);
		expect(suggestMentions(users, 'berg')).toEqual([annaBerg]);
		expect(suggestMentions(users, '')).toHaveLength(4);
	});
});
