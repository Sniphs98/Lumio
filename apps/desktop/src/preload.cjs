const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lumio', {
	isDesktop: true,
	setServerUrl: (url) => ipcRenderer.invoke('lumio:set-server-url', url)
});
