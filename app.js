import path from "node:path";
import { pathToFileURL } from "node:url";
import Initialize from "./app/initialize.js";

export const PORT = 8765;

function listenPort() {
  const n = Number(process.env.PZMAP_PORT);
  if (Number.isInteger(n) && n >= 1 && n <= 65535) return n;
  return PORT;
}

function canRetryListen(err) {
  return err && (err.code === "EACCES" || err.code === "EADDRINUSE");
}

export class Application {
  constructor() {
    this.server = null;
    this.port = PORT;
    this.initializer = new Initialize();
    this.shutdownHandler = null;
  }

  start() {
    const startPort = listenPort();
    this.server = this.initializer.init();
    this.setupGracefulShutdown();
    return new Promise((resolve, reject) => {
      const tryListen = (port) => {
        const onError = (err) => {
          this.server.off("listening", onListening);
          if (canRetryListen(err) && port < startPort + 500 && port < 65535) {
            tryListen(port + 1);
            return;
          }
          reject(err);
        };
        const onListening = () => {
          this.server.off("error", onError);
          this.port = this.server.address().port;
          const stats = this.initializer.stats;
          console.log("地图: http://127.0.0.1:" + this.port + "/");
          console.log(
            "标注 " + stats.labels + "（未汉化 " + stats.missingZh + "）· 街道 " + stats.streets +
              " · 建筑/路/水 " + stats.world + " · 森林面 " + stats.forest,
          );
          resolve();
        };
        this.server.once("error", onError);
        this.server.once("listening", onListening);
        this.server.listen(port, "127.0.0.1");
      };
      tryListen(startPort);
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    this.initializer.cleanup();
  }

  createShutdownHandler() {
    let isShuttingDown = false;
    return () => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      this.stop();
      process.exit(0);
    };
  }

  setupGracefulShutdown() {
    this.shutdownHandler = this.createShutdownHandler();
    process.on("SIGINT", this.shutdownHandler);
    process.on("SIGTERM", this.shutdownHandler);
  }
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return pathToFileURL(path.resolve(entry)).href === import.meta.url;
}

if (isDirectRun()) {
  const appInstance = new Application();
  appInstance.start().catch((err) => {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  });
}
