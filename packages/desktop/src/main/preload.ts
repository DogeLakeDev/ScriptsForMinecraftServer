import { contextBridge, ipcRenderer, webUtils } from "electron";
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
  uploadPack: (id, paths) => ipcRenderer.invoke("sfmc:uploadPack", id, paths),
  packFilePath: file => webUtils.getPathForFile(file),
  update: action => ipcRenderer.invoke("sfmc:update", action),
  openLink: (kind, url) => ipcRenderer.invoke("sfmc:openLink", kind, url),
  appearance: mode => ipcRenderer.invoke("sfmc:appearance", mode),
  appInfo: () => ipcRenderer.invoke("sfmc:appInfo"),
  preferences: () => ipcRenderer.invoke("sfmc:preferences"),
  setPreferences: patch => ipcRenderer.invoke("sfmc:setPreferences", patch),
  deviceLoginStart: endpoint => ipcRenderer.invoke("sfmc:deviceLoginStart", endpoint),
  deviceLoginPoll: deviceId => ipcRenderer.invoke("sfmc:deviceLoginPoll", deviceId),
  deviceLoginCancel: deviceId => ipcRenderer.invoke("sfmc:deviceLoginCancel", deviceId),
  onEvent: callback => { const listener = (_event: unknown, id: string, event: Parameters<Parameters<DesktopApi["onEvent"]>[0]>[1]) => callback(id, event); ipcRenderer.on("sfmc:event", listener); return () => ipcRenderer.removeListener("sfmc:event", listener); },
  onConnection: callback => { const listener = (_event: unknown, id: string, message: string, progress: number | null) => callback(id, message, progress); ipcRenderer.on("sfmc:connection", listener); return () => ipcRenderer.removeListener("sfmc:connection", listener); },
};
contextBridge.exposeInMainWorld("sfmc", api);
