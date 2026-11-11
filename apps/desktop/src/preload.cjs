const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lumio', {
	isDesktop: true,
	setServer: (url, tailcat) => ipcRenderer.invoke('lumio:set-server', { url, tailcat })
});
