import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "../lib/icons";
import { plateTxt } from "../lib/format";
import type { OrderState } from "../lib/types";

export const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Mantiene montado un elemento mientras dura su animación de salida. */
export function useMountTransition(open: boolean, exitMs: number) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      return () => cancelAnimationFrame(r);
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(t);
  }, [open, exitMs]);
  return [mounted, visible] as const;
}

function useEscape(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [active, onClose]);
}

/* ---------- Ventana modal (en celular sube desde abajo) ---------- */
export function Modal({ open, onClose, wide, label, children }: { open: boolean; onClose: () => void; wide?: boolean; label: string; children: ReactNode }) {
  const [mounted, visible] = useMountTransition(open, 220);
  useEscape(open, onClose);
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => (card.current?.querySelector<HTMLElement>("[autofocus], .card-body input:not([type=hidden]), .card-body select, .card-body textarea") ?? card.current?.querySelector<HTMLElement>(".icon-btn"))?.focus({ preventScroll: true }), 60);
    return () => clearTimeout(t);
  }, [visible]);
  if (!mounted) return null;
  return (
    <div className={`modal ${visible ? "open" : ""}`} aria-hidden={!visible}>
      <div className="scrim" onClick={onClose} />
      <div ref={card} className={`card ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={label}>{children}</div>
    </div>
  );
}

export function ModalHead({ title, kicker, onClose }: { title: ReactNode; kicker?: ReactNode; onClose: () => void }) {
  return (
    <div className="card-head">
      <h2>{kicker && <span className="kicker">{kicker}</span>}{title}</h2>
      <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><Icon n="x" /></button>
    </div>
  );
}

/* ---------- Panel lateral (en celular, hoja que se arrastra hacia abajo para cerrar) ---------- */
export function Sheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  const [mounted, visible] = useMountTransition(open, 260);
  useEscape(open, onClose);
  const sheet = useRef<HTMLElement>(null);
  const drag = useRef<{ id: number; y0: number; h: { y: number; t: number }[]; dy: number } | null>(null);

  const onDown = (e: React.PointerEvent) => {
    if (!window.matchMedia("(max-width: 640px)").matches || drag.current) return;
    const t = e.target as HTMLElement;
    if (!t.closest(".grab, .grab-zone") || t.closest("button, a, input, select")) return;
    drag.current = { id: e.pointerId, y0: e.clientY, h: [{ y: e.clientY, t: e.timeStamp }], dy: 0 };
    sheet.current!.setPointerCapture(e.pointerId);
    sheet.current!.style.transition = "none";
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    let dy = e.clientY - d.y0;
    if (dy < 0) { const dim = sheet.current!.offsetHeight; dy = -((-dy * dim * 0.55) / (dim + 0.55 * -dy)); }
    d.dy = dy;
    sheet.current!.style.transform = `translateY(${dy}px)`;
    d.h.push({ y: e.clientY, t: e.timeStamp });
    if (d.h.length > 6) d.h.shift();
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const a = d.h[0], b = d.h[d.h.length - 1];
    const v = b.t > a.t ? (b.y - a.y) / (b.t - a.t) : 0;
    drag.current = null;
    sheet.current!.style.transition = "";
    sheet.current!.style.transform = "";
    if (d.dy > 140 || (v > 0.5 && d.dy > 10)) onClose();
  };

  if (!mounted) return null;
  return (
    <div className={`drawer ${visible ? "open" : ""}`} aria-hidden={!visible}>
      <div className="scrim" onClick={onClose} />
      <section ref={sheet} className="sheet" role="dialog" aria-modal="true" aria-label={label} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <div className="grab" aria-hidden="true" />
        {children}
      </section>
    </div>
  );
}

/* ---------- Control segmentado con indicador que se desliza ---------- */
export function Seg<T extends string>({ value, options, onChange, full, label }: { value: T; options: [T, ReactNode][]; onChange: (v: T) => void; full?: boolean; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLSpanElement>(null);
  const ready = useRef(false);
  const place = useCallback(() => {
    const on = ref.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    const t = thumb.current;
    if (!on || !t || !on.offsetWidth) return;
    if (!ready.current) t.style.transition = "none";
    t.style.width = `${on.offsetWidth}px`;
    t.style.transform = `translateX(${on.offsetLeft - 3}px)`;
    if (!ready.current) { void t.offsetWidth; t.style.transition = ""; ready.current = true; }
  }, []);
  useLayoutEffect(place, [value, place]);
  useEffect(() => {
    const ro = new ResizeObserver(() => { ready.current = false; place(); });
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, [place]);
  return (
    <div className={`seg ${full ? "full" : ""}`} ref={ref} role="group" aria-label={label}>
      <span className="thumb" ref={thumb} />
      {options.map(([v, l]) => (
        <button type="button" key={v} aria-pressed={v === value} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  );
}

/* ---------- Piezas pequeñas ---------- */
export const Plate = ({ plate }: { plate: string }) => <span className="plate">{plateTxt(plate)}</span>;

export const STATE_LABEL: Record<OrderState, string> = { revision: "Revisión", presupuesto: "Presupuesto", reparacion: "En reparación", listo: "Listo", entregado: "Entregado", cancelado: "Cancelado" };
const PILL_CLASS: Partial<Record<OrderState, string>> = { revision: "st-revision", presupuesto: "st-aprobacion", reparacion: "st-reparacion", listo: "st-listo" };
export function StatePill({ state }: { state: OrderState }) {
  if (state === "entregado" || state === "cancelado") return <span className="tag">{STATE_LABEL[state]}</span>;
  return <span className={`pill ${PILL_CLASS[state]}`}>{STATE_LABEL[state]}</span>;
}

export const Empty = ({ children, pad }: { children: ReactNode; pad?: number }) => <div className="empty" style={pad ? { padding: pad } : undefined}>{children}</div>;

export function Loading({ rows = 3 }: { rows?: number }) {
  return <div className="loading" aria-busy="true" aria-label="Cargando">{Array.from({ length: rows }, (_, i) => <span key={i} />)}</div>;
}

export function ErrorBox({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="empty">
      <p style={{ marginBottom: 12 }}>{error instanceof Error ? error.message : "No se pudo cargar."}</p>
      {retry && <button className="btn sm" onClick={retry}>Intentar de nuevo</button>}
    </div>
  );
}

/* ---------- Avisos breves ---------- */
type ToastItem = { id: number; msg: string; kind: "ok" | "info" | "error"; state: "in" | "out" | "new" };
const ToastCtx = createContext<(msg: string, kind?: ToastItem["kind"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const toast = useCallback((msg: string, kind: ToastItem["kind"] = "ok") => {
    const id = ++seq.current;
    setList((l) => [...l.slice(-2), { id, msg, kind, state: "new" }]);
    requestAnimationFrame(() => requestAnimationFrame(() => setList((l) => l.map((t) => (t.id === id ? { ...t, state: "in" } : t)))));
    setTimeout(() => setList((l) => l.map((t) => (t.id === id ? { ...t, state: "out" } : t))), kind === "error" ? 4500 : 2800);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), (kind === "error" ? 4500 : 2800) + 220);
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toasts" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className={`toast ${t.kind === "error" ? "err" : ""} ${t.state === "in" ? "in" : ""} ${t.state === "out" ? "leaving" : ""}`}>
            <Icon n={t.kind === "ok" ? "check" : "info"} /><span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
