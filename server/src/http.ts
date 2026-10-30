import type { NextFunction, Request, Response, RequestHandler } from "express";
import { ZodError, type ZodTypeAny, type z } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const notFound = (what = "El registro") => new HttpError(404, `${what} no existe.`);
export const forbidden = () => new HttpError(403, "No tienes permiso para hacer esto.");

/** Envuelve un handler para que los errores lleguen al manejador central. */
export const ah = (fn: (req: Request, res: Response) => unknown): RequestHandler =>
  (req, res, next) => {
    try {
      const out = fn(req, res);
      if (out instanceof Promise) out.catch(next);
    } catch (e) {
      next(e);
    }
  };

export function parse<T extends ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) throw r.error;
  return r.data;
}

export const idParam = (req: Request, name = "id") => {
  const n = Number(req.params[name]);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "Identificador inválido.");
  return n;
};

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return res.status(400).json({ error: first?.message || "Datos inválidos.", field: first?.path.join(".") });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  const msg = err instanceof Error ? err.message : String(err);
  if (/UNIQUE constraint failed: vehicles\.plate/.test(msg)) return res.status(409).json({ error: "Ya existe un vehículo con esa placa." });
  if (/UNIQUE constraint failed: parts\.code/.test(msg)) return res.status(409).json({ error: "Ya existe un repuesto con ese código." });
  if (/UNIQUE constraint failed: users\.username/.test(msg)) return res.status(409).json({ error: "Ese nombre de usuario ya está en uso." });
  console.error(err);
  res.status(500).json({ error: "Ocurrió un error inesperado. Intenta de nuevo." });
}
