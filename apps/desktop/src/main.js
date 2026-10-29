import { app, BrowserWindow, desktopCapturer, ipcMain, session, shell } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// The desktop app only wraps a Lumio server's web UI. The server URL is asked for on
// first start and stored in the user data folder. Set LUMIO_URL to override it.
const configPath = path.join(app.getPath('userData'), 'config.json');

async function loadServerUrl() {
	if (process.env.LUMIO_URL) return process.env.LUMIO_URL;
	try {
		const config = JSON.parse(await readFile(configPath, 'utf8'));
		return typeof config.serverUrl === 'string' ? config.serverUrl : null;
	} catch {
		return null;
	}
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

	const serverUrl = await loadServerUrl();
	if (serverUrl) {
		await win.loadURL(serverUrl);
	} else {
		await win.loadFile(path.join(import.meta.dirname, 'setup.html'));
	}
}

ipcMain.handle('lumio:set-server-url', async (event, url) => {
	// Only the setup page may change the server, not the web pages of a server.
	if (!event.senderFrame?.url.startsWith('file:')) throw new Error('Not allowed');
	const parsed = new URL(url);
	if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
		throw new Error('Server URL must start with http:// or https://');
	}
	await writeFile(configPath, JSON.stringify({ serverUrl: parsed.origin }));
	await BrowserWindow.fromWebContents(event.sender)?.loadURL(parsed.origin);
});

app.whenReady().then(() => {
	// Screen sharing: let getDisplayMedia() pick a screen.
	// TODO: replace with a picker UI listing screens and windows.
	session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
		const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] });
		callback({ video: sources[0], audio: 'loopback' });
	});

	createWindow();

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});
