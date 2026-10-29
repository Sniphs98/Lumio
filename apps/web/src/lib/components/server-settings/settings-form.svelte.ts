import { applyAction, type SubmitFunction } from '$app/forms';
import { refreshAll } from '$app/navigation';

/**
 * The state of one form in the server settings. The actions live on the server settings route,
 * so the dialog shows their result itself and reloads the data instead of applying it to the
 * page that happens to be open.
 */
export function settingsForm() {
	let error = $state<string>();
	let saved = $state(false);

	const submit: SubmitFunction = () => {
		error = undefined;
		saved = false;
		return async ({ result }) => {
			if (result.type === 'success') {
				saved = true;
				await refreshAll();
			} else if (result.type === 'failure') {
				error = String(result.data?.error ?? 'That did not work.');
			} else {
				await applyAction(result);
			}
		};
	};

	return {
		get error() {
			return error;
		},
		get saved() {
			return saved;
		},
		submit
	};
}
