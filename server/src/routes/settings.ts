import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../auth.js";
import { backupPath, createBackup, listBackups } from "../backup.js";
import { db } from "../db/client.js";
import { DEFAULT_SETTINGS } from "../db/catalog.js";
import { settings } from "../db/schema.js";
import { ah, notFound, parse } from "../http.js";
import { env } from "../env.js";

export const settingsRouter = Router();

export function readSettings() {
  const out: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const r of db.select().from(settings).all()) out[r.key] = r.value;
  return out;
}

settingsRouter.get("/settings", ah((_req, res) => res.json(readSettings())));

settingsRouter.put("/settings", requireAdmin, ah((req, res) => {
  const b = parse(z.object({
    businessName: z.string().trim().min(2, "Escribe el nombre del taller.").max(80),
    tagline: z.string().trim().max(120),
    phone: z.string().trim().max(30),
    address: z.string().trim().max(160),
    receiptNote: z.string().trim().max(200),
  }).partial(), req.body);
  for (const [key, value] of Object.entries(b)) {
    db.insert(settings).values({ key, value: value as string }).onConflictDoUpdate({ target: settings.key, set: { value: value as string } }).run();
  }
  res.json(readSettings());
}));

settingsRouter.get("/backups", requireAdmin, ah((_req, res) => res.json({ folder: env.backupDir, extraFolder: env.backupExtraDir, keep: env.backupKeep, list: listBackups() })));

settingsRouter.post("/backups", requireAdmin, ah(async (_req, res) => {
  const name = await createBackup();
  res.status(201).json({ name });
}));

settingsRouter.get("/backups/:name", requireAdmin, ah((req, res) => {
  const p = backupPath(String(req.params.name));
  if (!p) throw notFound("La copia");
  res.download(p);
}));
