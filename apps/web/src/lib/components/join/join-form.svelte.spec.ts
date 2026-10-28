import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import JoinForm from './join-form.svelte';

vi.mock('$app/forms', () => ({ enhance: () => ({ destroy: () => {} }) }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

describe('JoinForm', () => {
	it('starts with the guest form, which only asks for a name', async () => {
		render(JoinForm, { allowGuests: true });

		await expect.element(page.getByLabelText('Your name')).toBeVisible();
		await expect.element(page.getByLabelText('Email')).not.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Join as guest' })).toBeVisible();
	});

	it('switches to creating an account', async () => {
		render(JoinForm, { allowGuests: true });

		await page.getByRole('tab', { name: 'Create account' }).click();
		await expect.element(page.getByLabelText('Display name')).toBeVisible();
		await expect.element(page.getByLabelText('Email')).toBeVisible();
		await expect.element(page.getByLabelText('Password')).toBeVisible();
		await expect
			.element(page.getByRole('button', { name: 'Create account and join' }))
			.toBeVisible();
	});

	it('only offers an account when the link does not allow guests', async () => {
		render(JoinForm, { allowGuests: false, message: 'Registration failed' });

		await expect.element(page.getByRole('tab')).not.toBeInTheDocument();
		await expect.element(page.getByLabelText('Email')).toBeVisible();
		await expect.element(page.getByRole('alert')).toHaveTextContent('Registration failed');
	});
});
