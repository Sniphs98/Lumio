import { createContext } from 'svelte';
import type { VoiceState } from '#lib/calls.ts';

/** Who is in which voice channel, kept live by the channels layout for its pages. */
export const [getVoiceContext, setVoiceContext] = createContext<{
	readonly channels: VoiceState;
}>();
