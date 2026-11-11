import { app, BrowserWindow, desktopCapturer, ipcMain, session, shell } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { startTunnelProxy } from './proxy.js';
import { isTailcatAddress, startForward } from './tailcat.js';

// The desktop app only wraps a Lumio server's web UI. The server URL is asked for on
// first start and stored in the user data folder. Set LUMIO_URL to override it, and
// LUMIO_TAILCAT_ADDRESS to reach the server through a tailcat tunnel.
const configPath = path.join(app.getPath('userData'), 'config.json');

/** @returns {Promise<{ serverUrl: string | null, tailcat: string | null }>} */
async function loadConfig() {
	let config = {};
	try {
		config = JSON.parse(await readFile(configPath, 'utf8'));
	} catch {
		// First start.
	}
	const text = (value) => (typeof value === 'string' && value ? value : null);
	return {
		serverUrl: process.env.LUMIO_URL || text(config.serverUrl),
		tailcat: process.env.LUMIO_TAILCAT_ADDRESS || text(config.tailcat)
	};
}

// Guests without a route to the server (no public IP, no open ports) can reach it through
// tailcat: `tailcat forward` carries port 443 and the TURN port to the server, and a local
// proxy sends all HTTPS of the window into the tunnel. Certificates are checked as usual, so
// the server still needs a valid one. See deploy/tailcat/README.md.
/** @type {{ address: string, stop: () => Promise<void> } | null} */
let tunnel = null;

async function openTunnel(address) {
	if (tunnel?.address === address) return;
	await closeTunnel();
	const forward = await startForward({ address });
	let proxy;
	try {
		proxy = await startTunnelProxy({ tunnelPort: forward.httpsPort });
	} catch (error) {
		forward.stop();
		throw error;
	}
	const current = {
		address,
		stop: async () => {
			forward.stop();
			await proxy.close();
		}
	};
	tunnel = current;
	// If tailcat stops on its own, connect directly again: pages then fail to load and the
	// window shows the setup page with the error, from where connecting starts tailcat again.
	forward.child.once('exit', () => {
		if (tunnel === current) closeTunnel();
	});
	await session.defaultSession.setProxy({
		proxyRules: `http://127.0.0.1:${proxy.port}`
	});
	await session.defaultSession.closeAllConnections();
}

async function closeTunnel() {
	if (!tunnel) return;
	const { stop } = tunnel;
	tunnel = null;
	await session.defaultSession.setProxy({ mode: 'direct' });
	await stop();
}

/** Shows the setup page, filled in with the current settings and an error, if any. */
function showSetup(win, { serverUrl = '', tailcat = '', error = '' } = {}) {
	return win.loadFile(path.join(import.meta.dirname, 'setup.html'), {
		query: { url: serverUrl ?? '', tailcat: tailcat ?? '', error }
	});
}

/** Only web links go to the default browser: other schemes can start programs on the computer. */
function openInBrowser(url) {
	try {
		const { protocol } = new URL(url);
		if (protocol === 'https:' || protocol === 'http:') shell.openExternal(url);
	} catch {
		// Not a URL.
	}
}

async function createWindow() {
	const win = new BrowserWindow({
		width: 1280,
		height: 800,
		minWidth: 400,
		backgroundColor: '#09090b',
		webPreferences: {
			preload: path.join(import.meta.dirname, 'preload.cjs'),
			contextIsolation: true,
			sandbox: true
		}
	});

	// Open external links in the default browser instead of a new Electron window.
	win.webContents.setWindowOpenHandler(({ url }) => {
		openInBrowser(url);
		return { action: 'deny' };
	});
	// The window only shows the Lumio server. Links to other sites open in the browser, so
	// they never get the desktop bridge from the preload script.
	win.webContents.on('will-navigate', (event, url) => {
		const current = win.webContents.getURL();
		if (current.startsWith('file:') || new URL(url).origin === new URL(current).origin) return;
		event.preventDefault();
		openInBrowser(url);
	});

	// When the server cannot be reached (wrong address, server down, tunnel not connecting),
	// go back to the setup page instead of leaving an empty window.
	win.webContents.on('did-fail-load', async (_event, code, description, url, isMainFrame) => {
		// -3 is ERR_ABORTED: a navigation replaced by another one, not a failure.
		if (!isMainFrame || code === -3 || url.startsWith('file:')) return;
		const config = await loadConfig();
		showSetup(win, {
			...config,
			error: `Could not open ${url}: ${description}`
		});
	});

	const config = await loadConfig();
	if (!config.serverUrl) {
		await showSetup(win);
		return;
	}
	try {
		if (config.tailcat) await openTunnel(config.tailcat);
	} catch (error) {
		await showSetup(win, { ...config, error: error.message });
		return;
	}
	// A failed load shows the setup page, see did-fail-load above.
	await win.loadURL(config.serverUrl).catch(() => {});
}

ipcMain.handle('lumio:set-server', async (event, { url, tailcat = '' }) => {
	// Only the setup page may change the server, not the web pages of a server.
	if (!event.senderFrame?.url.startsWith('file:')) throw new Error('Not allowed');
	const parsed = new URL(url);
	if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
		throw new Error('Server URL must start with http:// or https://');
	}
	const address = tailcat.trim();
	if (address) {
		if (!isTailcatAddress(address)) throw new Error('That is not a tailcat address (tc...).');
		if (parsed.protocol !== 'https:') {
			throw new Error('Through tailcat the server URL must start with https://');
		}
		await openTunnel(address);
	} else {
		await closeTunnel();
	}
	await writeFile(
		configPath,
		JSON.stringify({
			serverUrl: parsed.origin,
			...(address && { tailcat: address })
		})
	);
	// An invite link opens the invite; only the origin is kept.
	await BrowserWindow.fromWebContents(event.sender)
		?.loadURL(parsed.href)
		.catch(() => {});
});

app.whenReady().then(() => {
	// Screen sharing: let getDisplayMedia() pick a screen.
	// TODO: replace with a picker UI listing screens and windows.
	session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
		const sources = await desktopCapturer.getSources({
			types: ['screen', 'window']
		});
		callback({ video: sources[0], audio: 'loopback' });
	});

	createWindow();

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on('will-quit', () => {
	closeTunnel();
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});
