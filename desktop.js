import { app, BrowserWindow, Menu } from "electron";
import { Application } from "./app.js";

let win = null;
const application = new Application();

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "PZ 纸质地图",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.once("ready-to-show", () => {
    win.show();
  });
  win.on("closed", () => {
    win = null;
  });
  win.loadURL("http://127.0.0.1:" + application.port + "/");
}

const locked = app.requestSingleInstanceLock();
if (!locked) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  Menu.setApplicationMenu(null);
  app.whenReady().then(async () => {
    await application.start();
    createWindow();
  });
  app.on("window-all-closed", () => {
    application.stop();
    app.quit();
  });
}
