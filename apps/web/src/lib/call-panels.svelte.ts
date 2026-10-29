import { getContext, setContext, untrack } from 'svelte';

const key = Symbol('call-panels');

/**
 * Counts the sidebar call panels that are mounted, so the app layout only shows the
 * full-width call bar where there is no sidebar (phones, the account page).
 */
export function createCallPanels() {
	let count = $state(0);
	return {
		get count() {
			return count;
		},
		/**
		 * Called from a panel's effect; returns the function to call on unmount. Untracked, so
		 * the effect does not depend on the count it changes and run again forever.
		 */
		register() {
			untrack(() => count++);
			return () => untrack(() => count--);
		}
	};
}

type CallPanels = ReturnType<typeof createCallPanels>;

export const setCallPanels = (panels: CallPanels) => setContext(key, panels);

/** Undefined outside the app layout, e.g. in component tests. */
export const getCallPanels = () => getContext<CallPanels | undefined>(key);
