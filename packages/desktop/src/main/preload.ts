import { contextBridge, ipcRenderer } from "electron";
import type { DesktopApi } from "../shared/api.js";
const api: DesktopApi = {
  profiles: () => ipcRenderer.invoke("sfmc:profiles"),
  saveProfile: (profile, credentials) => ipcRenderer.invoke("sfmc:saveProfile", profile, credentials),
  removeProfile: id => ipcRenderer.invoke("sfmc:removeProfile", id),
  connect: (id, credentials) => ipcRenderer.invoke("sfmc:connect", id, credentials),
  disconnect: id => ipcRenderer.invoke("sfmc:disconnect", id),
  confirmHost: id => ipcRenderer.invoke("sfmc:confirmHost", id),
  request: (id, method, params) => ipcRenderer.invoke("sfmc:request", id, method, params),
  choose: kind => ipcRenderer.invoke("sfmc:choose", kind),
  uploadPack: id => ipcRenderer.invoke("sfmc:uploadPack", id),
  update: action => ipcRenderer.invoke("sfmc:update", action),
  openLink: kind => ipcRenderer.invoke("sfmc:openLink", kind),
  appearance: mode => ipcRenderer.invoke("sfmc:appearance", mode),
  appInfo: () => ipcRenderer.invoke("sfmc:appInfo"),
  onEvent: callback => { const listener = (_event: unknown, id: string, event: Parameters<Parameters<DesktopApi["onEvent"]>[0]>[1]) => callback(id, event); ipcRenderer.on("sfmc:event", listener); return () => ipcRenderer.removeListener("sfmc:event", listener); },
  onConnection: callback => { const listener = (_event: unknown, id: string, message: string) => callback(id, message); ipcRenderer.on("sfmc:connection", listener); return () => ipcRenderer.removeListener("sfmc:connection", listener); },
};
contextBridge.exposeInMainWorld("sfmc", api);
