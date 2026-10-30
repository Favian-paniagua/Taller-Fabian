import fs from "node:fs";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { loadUser, requireAuth } from "./auth.js";
import { env } from "./env.js";
import { errorHandler, HttpError } from "./http.js";
import { authRouter } from "./routes/auth.js";
import { catalogRouter } from "./routes/catalog.js";
import { clientsRouter } from "./routes/clients.js";
import { ordersRouter } from "./routes/orders.js";
import { reportsRouter } from "./routes/reports.js";
import { settingsRouter } from "./routes/settings.js";
import { usersRouter } from "./routes/users.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        "default-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
        "img-src": ["'self'", "data:"],
        "connect-src": ["'self'"],
        "upgrade-insecure-requests": null, // la red del taller usa http
      },
    },
    hsts: false,
    crossOriginOpenerPolicy: false,
  }));
  app.use(express.json({ limit: "200kb" }));
  app.use(cookieParser());
  app.use(loadUser);

  const api = express.Router();
  api.get("/health", (_req, res) => res.json({ ok: true }));
  api.use("/auth", authRouter);
  api.use(requireAuth);
  api.use(settingsRouter);
  api.use(usersRouter);
  api.use(catalogRouter);
  api.use(ordersRouter);
  api.use(clientsRouter);
  api.use(reportsRouter);
  api.use((_req, _res, next) => next(new HttpError(404, "Esa ruta no existe.")));
  app.use("/api", api);

  // Pantallas ya compiladas (web/dist). Cualquier otra ruta devuelve la aplicación.
  if (fs.existsSync(path.join(env.webDist, "index.html"))) {
    app.use(express.static(env.webDist, { index: false, maxAge: "7d", setHeaders: (res, p) => { if (p.endsWith(".html")) res.setHeader("Cache-Control", "no-cache"); } }));
    app.get("*", (_req, res) => res.sendFile(path.join(env.webDist, "index.html"), { headers: { "Cache-Control": "no-cache" } }));
  }

  app.use(errorHandler);
  return app;
}
