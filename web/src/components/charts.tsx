import { useEffect, useRef, useState, type ReactNode } from "react";
import { dateShort, dayLong, money, nf1 } from "../lib/format";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceTop(max: number, parts = 4) {
  const raw = Math.max(1, max) / parts, mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  return { step, top: Math.ceil(Math.max(1, max) / step) * step };
}
const tick = (cents: number) => { const v = cents / 100; return v >= 1000 ? `${(v / 1000).toLocaleString("es-BO", { maximumFractionDigits: 1 })} mil` : v.toLocaleString("es-BO"); };
const range = (top: number, step: number) => { const out: number[] = []; for (let v = 0; v <= top + 0.001; v += step) out.push(v); return out; };

function Tip({ x, hostW, shown, children }: { x: number; hostW: number; shown: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState(0);
  const was = useRef(false);
  useEffect(() => {
    const tw = ref.current?.offsetWidth ?? 180;
    setLeft(Math.min(Math.max(0, x - tw / 2), hostW - tw));
  }, [x, hostW, children]);
  const instant = shown && was.current;
  useEffect(() => { was.current = shown; }, [shown]);
  return <div ref={ref} className={`tip ${shown ? "show" : ""} ${instant ? "instant" : ""}`} style={{ left, top: -8 }} role="status">{children}</div>;
}

/* ---------- Ingresos por día o semana: columnas apiladas ---------- */
export type Bucket = { t0: number; mo: number; rp: number; n: number; closed: boolean };
export function IncomeChart({ buckets, unit }: { buckets: Bucket[]; unit: "day" | "week" }) {
  const [ref, hostW] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const W = Math.max(280, hostW - 8), Hh = 230, L = 52, R = 12, T = 10, B = 28;
  const pw = W - L - R, ph = Hh - T - B;
  const { step, top } = niceTop(Math.max(...buckets.map((d) => d.mo + d.rp), 1));
  const y = (v: number) => T + ph - (v / top) * ph;
  const band = pw / Math.max(1, buckets.length);
  const bw = Math.min(24, Math.max(4, band * 0.62));
  const every = Math.max(1, Math.ceil((unit === "week" ? 52 : 44) / band));
  const r4 = (x: number, yTop: number, w: number, h: number) => { const r = Math.min(4, h, w / 2); return `M${x} ${yTop + h}V${yTop + r}Q${x} ${yTop} ${x + r} ${yTop}H${x + w - r}Q${x + w} ${yTop} ${x + w} ${yTop + r}V${yTop + h}Z`; };
  const name = (b: Bucket) => (unit === "week" ? `Semana del ${dateShort(b.t0)}` : dayLong(b.t0));
  const h = hover != null ? buckets[hover] : null;
  return (
    <div className="chart" ref={ref}>
      {hostW > 0 && (
        <svg viewBox={`0 0 ${W} ${Hh}`} width={W} height={Hh} className={hover != null ? "hovering" : ""} aria-label={`Ingresos por ${unit === "week" ? "semana" : "día"}`} onPointerLeave={(e) => e.pointerType === "mouse" && setHover(null)}>
          <g className="grid">{range(top, step).map((v) => <line key={v} x1={L} x2={W - R} y1={y(v)} y2={y(v)} />)}</g>
          <g className="axis">
            {range(top, step).map((v) => <text key={v} x={L - 8} y={y(v) + 4} textAnchor="end">{tick(v)}</text>)}
            {buckets.map((d, i) => {
              if ((buckets.length - 1 - i) % every !== 0) return null;
              const dt = new Date(d.t0);
              const lbl = unit === "week" ? dateShort(d.t0) : buckets.length <= 7 ? `${dt.toLocaleDateString("es-BO", { weekday: "short" }).replace(".", "")} ${dt.getDate()}` : String(dt.getDate());
              return <text key={i} x={L + band * i + band / 2} y={Hh - 8} textAnchor="middle">{lbl}</text>;
            })}
          </g>
          {buckets.map((d, i) => {
            const cx = L + band * i + band / 2, x = cx - bw / 2, moH = (d.mo / top) * ph, rpH = (d.rp / top) * ph;
            return (
              <g key={i} className={`col-g ${hover === i ? "on" : ""}`}>
                {d.mo > 0 && (d.rp > 0 ? <rect className="mo" x={x} y={T + ph - moH} width={bw} height={moH} /> : <path className="mo" d={r4(x, T + ph - moH, bw, moH)} />)}
                {d.rp > 0 && <path className="rp" d={r4(x, T + ph - moH - (d.mo > 0 ? 2 : 0) - rpH, bw, rpH)} />}
                {d.closed && band > 12 && <text className="closed" x={cx} y={T + ph - 6} textAnchor="middle">—</text>}
              </g>
            );
          })}
          {buckets.map((d, i) => (
            <rect key={i} className="hit" x={L + band * i} y={T} width={band} height={ph} tabIndex={0} role="img" aria-label={`${name(d)}: ${d.closed ? "cerrado" : money(d.mo + d.rp)}`}
              onPointerEnter={() => setHover(i)} onClick={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} />
          ))}
        </svg>
      )}
      <Tip x={hover != null ? L + band * hover + band / 2 : 0} hostW={hostW} shown={!!h}>
        {h && (<>
          <b>{name(h)}</b>
          {h.closed ? <span className="muted">Domingo, cerrado</span> : (<>
            <div><span><i className="sw1" />Mano de obra</span><span>{money(h.mo)}</span></div>
            <div><span><i className="sw2" />Repuestos</span><span>{money(h.rp)}</span></div>
            <div className="tot"><span>{h.n} {h.n === 1 ? "vehículo" : "vehículos"}</span><span>{money(h.mo + h.rp)}</span></div>
          </>)}
        </>)}
      </Tip>
    </div>
  );
}

/* ---------- Ingresos acumulados: este periodo contra el anterior ---------- */
export function CumChart({ cur, prev, start, period, curLabel, prevLabel }: { cur: number[]; prev: number[]; start: number; period: string; curLabel: string; prevLabel: string }) {
  const [ref, hostW] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = Math.max(1, cur.length);
  const W = Math.max(280, hostW - 8), Hh = 220, L = 52, R = 80, T = 14, B = 28;
  const pw = W - L - R, ph = Hh - T - B;
  const { step, top } = niceTop(Math.max(cur[n - 1] ?? 0, prev[n - 1] ?? 0, 1));
  const x = (i: number) => L + (n === 1 ? pw : (i / (n - 1)) * pw);
  const y = (v: number) => T + ph - (v / top) * ph;
  const line = (a: number[]) => a.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");
  const dayAt = (i: number) => { const d = new Date(start); d.setDate(d.getDate() + i); return d.getTime(); };
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(pw / 56))));
  const ya = y(cur[n - 1] ?? 0), yb = y(prev[n - 1] ?? 0);
  const idx = (e: React.PointerEvent<SVGRectElement>) => { const b = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect(); const px = ((e.clientX - b.left) / b.width) * W; return Math.max(0, Math.min(n - 1, Math.round(((px - L) / pw) * (n - 1)))); };
  return (
    <div className="chart" ref={ref}>
      {hostW > 0 && (
        <svg viewBox={`0 0 ${W} ${Hh}`} width={W} height={Hh} aria-label={`Ingresos acumulados: ${curLabel} ${money(cur[n - 1])}, ${prevLabel} ${money(prev[n - 1])}`}>
          <g className="grid">{range(top, step).map((v) => <line key={v} x1={L} x2={L + pw} y1={y(v)} y2={y(v)} />)}</g>
          <g className="axis">
            {range(top, step).map((v) => <text key={v} x={L - 8} y={y(v) + 4} textAnchor="end">{tick(v)}</text>)}
            {Array.from({ length: Math.ceil(n / every) }, (_, k) => k * every).map((i) => {
              const t = dayAt(i), dt = new Date(t);
              const lbl = period === "semana" ? dt.toLocaleDateString("es-BO", { weekday: "short" }).replace(".", "") : period === "mes" ? String(dt.getDate()) : dateShort(t);
              return <text key={i} x={x(i)} y={Hh - 8} textAnchor="middle">{lbl}</text>;
            })}
          </g>
          <path className="a-cur" d={`${line(cur)}L${x(n - 1)} ${y(0)}L${x(0)} ${y(0)}Z`} />
          <path className="l-prev" d={line(prev)} />
          <path className="l-cur" d={line(cur)} />
          <circle className="dot-prev" cx={x(n - 1)} cy={yb} r={4} />
          <circle className="dot-cur" cx={x(n - 1)} cy={ya} r={4} />
          <text className="end-l" x={x(n - 1) + 10} y={ya + 4}>{money(cur[n - 1])}</text>
          {Math.abs(ya - yb) >= 16 && <text className="end-l p" x={x(n - 1) + 10} y={yb + 4}>{money(prev[n - 1])}</text>}
          {hover != null && (
            <g>
              <line className="xhair" x1={x(hover)} x2={x(hover)} y1={T} y2={T + ph} />
              <circle className="dot-prev" cx={x(hover)} cy={y(prev[hover] ?? 0)} r={4} />
              <circle className="dot-cur" cx={x(hover)} cy={y(cur[hover] ?? 0)} r={4} />
            </g>
          )}
          <rect className="hit" x={L} y={T} width={pw} height={ph} tabIndex={0} aria-label="Mueve para ver cada día"
            onPointerMove={(e) => setHover(idx(e))} onPointerDown={(e) => setHover(idx(e))} onPointerLeave={(e) => e.pointerType === "mouse" && setHover(null)}
            onFocus={() => setHover(n - 1)} onBlur={() => setHover(null)}
            onKeyDown={(e) => { if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? n - 1) - 1)); if (e.key === "ArrowRight") setHover((h) => Math.min(n - 1, (h ?? 0) + 1)); }} />
        </svg>
      )}
      <Tip x={hover != null ? x(hover) : 0} hostW={hostW} shown={hover != null}>
        {hover != null && (<>
          <b>Hasta el {dayLong(dayAt(hover))}</b>
          <div><span><i className="sw1" />{curLabel}</span><span>{money(cur[hover])}</span></div>
          <div><span><i className="swp" />{prevLabel}</span><span>{money(prev[hover])}</span></div>
        </>)}
      </Tip>
    </div>
  );
}

/* ---------- Dona por tipo de trabajo ---------- */
export function Donut({ items, total }: { items: { name: string; total: number; n: number }[]; total: number }) {
  const [on, setOn] = useState<number | null>(null);
  const Ro = 76, Ri = 50, c = 80;
  const p = (rad: number, ang: number) => `${(c + rad * Math.cos(ang)).toFixed(2)} ${(c + rad * Math.sin(ang)).toFixed(2)}`;
  let a0 = -Math.PI / 2;
  const segs = items.map((s, i) => {
    if (!s.total || !total) return null;
    let a = (s.total / total) * Math.PI * 2;
    if (a > Math.PI * 2 - 0.001) a = Math.PI * 2 - 0.001;
    const a1 = a0 + a, large = a > Math.PI ? 1 : 0;
    const d = `M${p(Ro, a0)} A${Ro} ${Ro} 0 ${large} 1 ${p(Ro, a1)} L${p(Ri, a1)} A${Ri} ${Ri} 0 ${large} 0 ${p(Ri, a0)} Z`;
    a0 = a1;
    return <path key={i} className={`seg-c${i + 1} ${on === i ? "on" : ""}`} d={d} onPointerEnter={() => setOn(i)} onClick={() => setOn(i)} />;
  });
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);
  const sel = on != null ? items[on] : null;
  return (
    <div className="donut-wrap">
      <div className="donut">
        <svg viewBox="0 0 160 160" role="img" className={on != null ? "hovering" : ""} aria-label={items.map((s) => `${s.name} ${pct(s.total)} %`).join(", ")} onPointerLeave={(e) => e.pointerType === "mouse" && setOn(null)}>
          {total ? segs : <circle cx="80" cy="80" r="63" fill="none" stroke="var(--surface-2)" strokeWidth="26" />}
        </svg>
        <div className="donut-c"><b>{money(sel ? sel.total : total)}</b><span>{sel ? <>{sel.name}<br />{pct(sel.total)} % del total</> : "en total"}</span></div>
      </div>
      <div className="donut-legend">
        {items.map((s, i) => (
          <div key={s.name} className={`dl-row ${on === i ? "on" : ""}`} tabIndex={0} onPointerEnter={() => setOn(i)} onPointerLeave={() => setOn(null)} onFocus={() => setOn(i)} onBlur={() => setOn(null)}>
            <i className={`sw-dot sw${i + 1}`} /><span>{s.name}</span><span className="v">{money(s.total)}</span>
            <small>{pct(s.total)} % · {s.n} {s.n === 1 ? "vehículo" : "vehículos"}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Días de la semana: el más movido resaltado ---------- */
const WD = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const WDL = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export function Weekdays({ values }: { values: number[] }) {
  const max = Math.max(0.0001, ...values), best = values.indexOf(Math.max(...values));
  return (
    <div className="wd" role="img" aria-label={WD.map((_, i) => `${WDL[i]} ${nf1.format(values[i] ?? 0)}`).join(", ")}>
      {WD.map((d, i) => {
        const h = ((values[i] ?? 0) / max) * 100;
        return (
          <div key={d} className={`wd-col ${i === best && values[i] > 0 ? "top" : ""}`}>
            <span className="wd-bar"><i style={{ height: `${h.toFixed(1)}%` }} /><span className="wd-v" style={{ bottom: `calc(${h.toFixed(1)}% + 4px)` }}>{nf1.format(values[i] ?? 0)}</span></span>
            <span className="wd-d">{d}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Mini tendencia y barras horizontales ---------- */
export function Spark({ values }: { values: (number | null)[] }) {
  const v = values.filter((x): x is number => x != null);
  if (v.length < 2) return <div className="spark-gap" />;
  const max = Math.max(...v), min = Math.min(...v), W = 120, Hh = 28;
  const pts: string[] = [];
  values.forEach((x, k) => { if (x != null) pts.push(`${((k / (values.length - 1)) * W).toFixed(1)} ${(Hh - 3 - ((x - min) / (max - min || 1)) * (Hh - 6)).toFixed(1)}`); });
  return <svg className="spark" viewBox={`0 0 ${W} ${Hh}`} preserveAspectRatio="none" aria-hidden="true"><polyline className="sp-base" points={pts.join(" ")} /><polyline className="sp-now" points={pts.slice(-2).join(" ")} /></svg>;
}

export function HBars({ rows, empty }: { rows: { key: string | number; name: ReactNode; val: ReactNode; bar: number }[]; empty: string }) {
  if (!rows.length) return <div className="empty">{empty}</div>;
  const max = Math.max(1, ...rows.map((x) => x.bar));
  return (
    <div className="hbars">
      {rows.map((x) => (
        <div key={x.key} className="hbar"><span className="name">{x.name}</span><span className="val">{x.val}</span><span className="track"><i style={{ width: `${Math.max(3, (x.bar / max) * 100).toFixed(1)}%` }} /></span></div>
      ))}
    </div>
  );
}
