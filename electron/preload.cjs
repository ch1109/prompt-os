const { contextBridge, ipcRenderer } = require("electron");

/**
 * 渲染层唯一的桌面能力入口。对应的类型声明与消费方式见 src/services/desktop.ts。
 * 只暴露快照同步相关的 5 个方法，不开放任意文件系统访问。
 */
contextBridge.exposeInMainWorld("promptOSDesktop", {
  isDesktop: true,
  getRepoRoot: () => ipcRenderer.invoke("repo:get"),
  chooseRepoRoot: () => ipcRenderer.invoke("repo:choose"),
  saveSnapshot: (body) => ipcRenderer.invoke("snapshot:save", body),
  readSnapshot: () => ipcRenderer.invoke("snapshot:read"),
  gitState: () => ipcRenderer.invoke("snapshot:gitState"),
});
