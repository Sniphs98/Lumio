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
		shell.openExternal(url);
		return { action: 'deny' };
	});

	const serverUrl = await loadServerUrl();
	if (serverUrl) {
		await win.loadURL(serverUrl);
	} else {
		await win.loadFile(path.join(import.meta.dirname, 'setup.html'));
	}
}

ipcMain.handle('lumio:set-server-url', async (_event, url) => {
	const parsed = new URL(url);
	if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
		throw new Error('Server URL must start with http:// or https://');
	}
	await writeFile(configPath, JSON.stringify({ serverUrl: parsed.origin }));
	const win = BrowserWindow.getFocusedWindow();
	await win?.loadURL(parsed.origin);
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
