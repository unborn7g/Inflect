'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('__inflectNativeCamera', {
 start: request => ipcRenderer.invoke('inflect:camera:start', { id: request.id, key: request.key }),
 stop: id => ipcRenderer.invoke('inflect:camera:stop', id),
 subscribe(callback) {
  const listener = (_event, value) => callback(value);
  ipcRenderer.on('inflect:camera:event', listener);
  return () => ipcRenderer.removeListener('inflect:camera:event', listener);
 }
});
