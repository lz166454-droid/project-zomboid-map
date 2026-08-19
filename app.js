import path from "node:path";
import { pathToFileURL } from "node:url";
import Initialize from "./app/initialize.js";

export const PORT = 8765;

export class Application {
  constructor() {
    this.server = null;
    this.initializer = new Initialize();
    this.shutdownHandler = null;
  }

  start() {
    this.server = this.initializer.init();
    this.setupGracefulShutdown();
    return new Promise((resolve, reject) => {
      const onError = (err) => {
        this.server.off("listening", onListening);
        reject(err);
      };
      const onListening = () => {
        this.server.off("error", onError);
        const stats = this.initializer.stats;
        console.log("地图: http://127.0.0.1:" + PORT + "/");
        console.log(
          "标注 " + stats.labels + "（未汉化 " + stats.missingZh + "）· 街道 " + stats.streets +
            " · 建筑/路/水 " + stats.world + " · 森林面 " + stats.forest,
        );
        resolve();
      };
      this.server.once("error", onError);
      this.server.listen(PORT, "127.0.0.1", onListening);
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
  appInstance.start();
}
