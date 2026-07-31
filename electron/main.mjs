import { app, BrowserWindow, protocol, net, ipcMain, dialog, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  readSnapshotGitState,
  writeSnapshotAndSync,
  snapshotAbsPath,
} from "../scripts/snapshotRepo.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** 打包后 electron/ 与 dist/ 一起躺在 app.asar 里，相对关系与仓库内一致。 */
const DIST = path.join(__dirname, "..", "dist");
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

/**
 * 自定义协议而非 file://。
 *
 * standard + secure 让 app://promptos 成为一个稳定的安全上下文 origin：
 * ① IndexedDB / localStorage 才能持久化，且升级版本后仍是同一个库；
 * ② 站点根绝对路径（/seed-prompts.json、/data-snapshot.json）与 BrowserRouter 的
 *    history 路由全都照常工作，渲染层无需改 base 或换 HashRouter。
 */
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

// ---------------------------------------------------------------- 桌面端配置

/** 仓库目录 + 窗口尺寸存在 userData，跟应用包分离，重装不丢。 */
const CONFIG_PATH = () => path.join(app.getPath("userData"), "desktop-config.json");

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH(), "utf8"));
  } catch {
    return {};
  }
}

function writeConfig(patch) {
  const next = { ...readConfig(), ...patch };
  try {
    fs.writeFileSync(CONFIG_PATH(), JSON.stringify(next, null, 2));
  } catch (e) {
    console.warn("[Prompt OS] 写入桌面端配置失败", e);
  }
  return next;
}

/** 仓库根：用户在设置页选过才有。未配置时同步类操作一律给出可执行的错误文案。 */
function getRepoRoot() {
  const root = readConfig().repoRoot;
  if (!root || !fs.existsSync(path.join(root, ".git"))) return null;
  return root;
}

const NO_REPO = "尚未选择 Prompt OS 仓库目录，请在设置页点「选择仓库目录…」";

// ---------------------------------------------------------------- 静态资源协议

function serveFromDist(reqUrl) {
  const pathname = decodeURIComponent(new URL(reqUrl).pathname);
  const target = path.join(DIST, pathname === "/" ? "index.html" : pathname);

  // 路径穿越防护：解析后必须仍在 dist 内
  if (target !== DIST && !target.startsWith(DIST + path.sep)) {
    return new Response("Forbidden", { status: 403 });
  }

  if (fs.existsSync(target) && fs.statSync(target).isFile()) {
    return net.fetch(pathToFileURL(target).toString());
  }

  // SPA 回退：/prompts、/settings 这类路由没有对应文件，交给 index.html 让
  // BrowserRouter 自己解析（刷新页面不白屏的关键）。带扩展名的才算真 404。
  if (!path.extname(pathname)) {
    return net.fetch(pathToFileURL(path.join(DIST, "index.html")).toString());
  }
  return new Response("Not Found", { status: 404 });
}

// ---------------------------------------------------------------- 窗口

function createWindow() {
  const { bounds } = readConfig();
  const win = new BrowserWindow({
    width: bounds?.width ?? 1440,
    height: bounds?.height ?? 900,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 900,
    minHeight: 600,
    title: "Prompt OS",
    titleBarStyle: "hiddenInset",
    backgroundColor: "#141414",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.on("close", () => writeConfig({ bounds: win.getNormalBounds() }));

  // 外链一律交给系统浏览器，绝不在应用内被导航走（导航走之后 app:// 的 SPA 就回不来了）。
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    const allowed = DEV_SERVER_URL ?? "app://";
    if (!url.startsWith(allowed)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  if (DEV_SERVER_URL) {
    // 调试 UI 用。注意 origin 是 localhost，IndexedDB 与打包后的 app:// 不是同一个库。
    win.loadURL(DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadURL("app://promptos/");
  }
  return win;
}

// ---------------------------------------------------------------- IPC

ipcMain.handle("repo:get", () => getRepoRoot());

ipcMain.handle("repo:choose", async () => {
  const res = await dialog.showOpenDialog({
    title: "选择 Prompt OS 仓库目录",
    properties: ["openDirectory"],
    message: "选择包含 public/data-snapshot.json 的仓库根目录",
  });
  if (res.canceled || !res.filePaths[0]) return { ok: false, error: "已取消" };
  const root = res.filePaths[0];
  if (!fs.existsSync(path.join(root, ".git"))) {
    return { ok: false, error: "该目录不是 git 仓库（缺少 .git）" };
  }
  if (!fs.existsSync(path.join(root, "public"))) {
    return { ok: false, error: "该目录下没有 public/，可能选错了层级" };
  }
  writeConfig({ repoRoot: root });
  return { ok: true, repoRoot: root };
});

ipcMain.handle("snapshot:save", (_e, body) => {
  const root = getRepoRoot();
  if (!root) return { ok: false, error: NO_REPO };
  try {
    return { ok: true, git: writeSnapshotAndSync(root, body) };
  } catch (e) {
    return { ok: false, error: `写入仓库快照失败：${String(e)}` };
  }
});

/** 读仓库目录里的实时快照（git pull 后立即生效）；未配置或文件不存在返回 null。 */
ipcMain.handle("snapshot:read", () => {
  const root = getRepoRoot();
  if (!root) return null;
  try {
    return fs.readFileSync(snapshotAbsPath(root), "utf8");
  } catch {
    return null;
  }
});

ipcMain.handle("snapshot:gitState", () => {
  const root = getRepoRoot();
  return root ? readSnapshotGitState(root) : null;
});

// ---------------------------------------------------------------- 生命周期

app.whenReady().then(() => {
  protocol.handle("app", (req) => serveFromDist(req.url));
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
