import type { User, Session } from 'better-auth';
import type { Admission } from '#lib/server/invites.ts';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Locals {
			user?: User & { isAnonymous?: boolean | null };
			session?: Session;
			/** The link a sign-up in progress came through, checked by the Better Auth user hook. */
			admission?: Admission;
			/** Name a guest picked, read by Better Auth when it creates the guest. */
			guestName?: string;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
