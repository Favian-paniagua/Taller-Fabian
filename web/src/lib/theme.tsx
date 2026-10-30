import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

const KEY = "taller-modo";
type Mode = "light" | "dark" | "auto";

const read = (): Mode => { try { const m = localStorage.getItem(KEY); return m === "light" || m === "dark" ? m : "auto"; } catch { return "auto"; } };
const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

let mode: Mode = read();
const listeners = new Set<() => void>();
export const isDark = () => (mode === "auto" ? systemDark() : mode === "dark");

function apply(m: Mode) {
  mode = m;
  if (m === "auto") document.documentElement.removeAttribute("data-mode");
  else document.documentElement.setAttribute("data-mode", m);
  try { m === "auto" ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, m); } catch { /* sin almacenamiento */ }
  listeners.forEach((l) => l());
}

export function toggleTheme() {
  const next: Mode = isDark() ? "light" : "dark";
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (doc.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) doc.startViewTransition(() => apply(next));
  else apply(next);
}

export function useDark() {
  const [dark, setDark] = useState(isDark);
  useEffect(() => {
    const on = () => setDark(isDark());
    listeners.add(on);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", on);
    return () => { listeners.delete(on); mq.removeEventListener("change", on); };
  }, []);
  return dark;
}

/** Interruptor de sol y luna. */
export function ThemeSwitch() {
  const dark = useDark();
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => { const r = requestAnimationFrame(() => ref.current?.classList.add("ready")); return () => cancelAnimationFrame(r); }, []);
  return (
    <button ref={ref} type="button" className="theme-sw" role="switch" aria-checked={dark} aria-label="Modo oscuro"
      title={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"} onClick={toggleTheme}>
      <span className="knob" />
      <span className="ico sun"><Icon n="sun" /></span>
      <span className="ico moon"><Icon n="moon" /></span>
    </button>
  );
}
