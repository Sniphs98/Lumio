import { GIPHY_API_KEY, TENOR_API_KEY } from '$app/env/private';
import { gifProviderFrom } from '#lib/server/gifs.ts';

/** The configured GIF service, or null when GIFs cannot be searched. */
export const gifProvider = gifProviderFrom({ GIPHY_API_KEY, TENOR_API_KEY });
