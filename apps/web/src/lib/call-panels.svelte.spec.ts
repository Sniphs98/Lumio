import { flushSync } from 'svelte';
import { describe, expect, it } from 'vitest';
import { createCallPanels } from './call-panels.svelte.ts';

describe('createCallPanels', () => {
	it('counts panels registered from effects without running them again', () => {
		const panels = createCallPanels();
		let runs = 0;
		const destroy = $effect.root(() => {
			$effect(() => {
				runs++;
				return panels.register();
			});
			$effect(() => {
				runs++;
				return panels.register();
			});
		});
		flushSync();
		expect(panels.count).toBe(2);
		expect(runs).toBe(2);

		destroy();
		expect(panels.count).toBe(0);
	});
});
