import express from "express";
import path from "path";
import http from "http";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { collabHub } from "./server/collabHub";
import { registerOnlineMediaRoutes } from "./server/onlineMedia";
import { socialHub } from "./server/socialHub";

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

collabHub.registerRoutes(app);
collabHub.attachWebSocketServer(server);
socialHub.registerRoutes(app);
socialHub.attachWebSocketServer(server);
registerOnlineMediaRoutes(app);

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    process.env.DISABLE_HMR = "true";
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false, watch: null },
      appType: "spa",
    });

    app.get("/@vite/client", async (_req, res, next) => {
      try {
        const result = await vite.transformRequest("/@vite/client");
        if (!result) {
          return next();
        }
        const patchedCode = result.code
          .replace(
            "transport.connect(createHMRHandler(handleMessage));",
            "/* HMR disabled: WebSocket connection suppressed */"
          )
          .replace(
            'throw new Error("send was called before connect");',
            "return;"
          )
          .replace(
            'throw new Error("invoke was called before connect");',
            "return;"
          );
        res.setHeader("Content-Type", "application/javascript");
        res.setHeader("Cache-Control", "no-cache");
        res.send(patchedCode);
      } catch (err) {
        next(err);
      }
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
