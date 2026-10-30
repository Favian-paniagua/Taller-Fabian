import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { Icon } from "../lib/icons";
import { useParts } from "../lib/queries";
import { money, toBs, when } from "../lib/format";
import type { Part } from "../lib/types";
import { Empty, ErrorBox, Loading, Modal, ModalHead, Seg, useToast } from "../components/ui";

const CAT_K: Record<string, string> = { Lubricantes: "k1", Filtros: "k2", Encendido: "k3", Frenos: "k4", "Transmisión": "k5", "Eléctrico": "k6", "Suspensión": "k7", Varios: "k8" };
type St = "todos" | "bien" | "limite" | "reponer";
const stockState = (p: Part): Exclude<St, "todos"> => (p.stock < p.minStock ? "reponer" : p.stock === p.minStock ? "limite" : "bien");

export default function Inventario() {
  const parts = useParts();
  const [params, setParams] = useSearchParams();
  const state = (params.get("estado") as St) || "todos";
  const setState = (s: St) => setParams(s === "todos" ? {} : { estado: s }, { replace: true });
  const [cat, setCat] = useState("Todos");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Part | "new" | null>(null);
  const [ingreso, setIngreso] = useState<Part | null>(null);
  const ORDER = Object.keys(CAT_K);
  const active = (parts.data ?? []).filter((p) => p.active).sort((a, b) => (ORDER.indexOf(a.category) - ORDER.indexOf(b.category)) || a.code.localeCompare(b.code));
  const cats = ["Todos", ...Object.keys(CAT_K).filter((c) => active.some((p) => p.category === c))];
  const value = active.reduce((a, p) => a + p.stock * (p.cost ?? 0), 0);
  const cnt = { bien: 0, limite: 0, reponer: 0 }; let out = 0;
  active.forEach((p) => { cnt[stockState(p)]++; if (p.stock === 0) out++; });
  const list = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return active.filter((p) => (cat === "Todos" || p.category === cat) && (state === "todos" || stockState(p) === state) && (!ql || (p.name + " " + p.code).toLowerCase().includes(ql)));
  }, [active, cat, state, q]);
  const tile = (st: Exclude<St, "todos">, cls: string, label: string, extra = "") => (
    <button className={`itile ${cls}`} aria-pressed={state === st} onClick={() => setState(state === st ? "todos" : st)}><span className="dot" /><b>{cnt[st]}</b><span>{label}{extra}</span></button>
  );

  return (
    <>
      <div className="page-head">
        <div><h1>Inventario de repuestos</h1><p>{active.length} productos · valor en almacén {money(value)} a costo</p></div>
        <button className="btn primary" onClick={() => setEdit("new")}><Icon n="plus" />Nuevo repuesto</button>
      </div>
      <div className="inv-tiles">
        {tile("bien", "st-ok", "Bien surtidos")}
        {tile("limite", "st-lim", "Al límite")}
        {tile("reponer", "st-low", "Por reponer", out ? ` · ${out} agotados` : "")}
      </div>
      <div className="toolbar">
        <label className="search"><Icon n="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o código" autoComplete="off" aria-label="Buscar" /></label>
        {state !== "todos" && <button className="chip" onClick={() => setState("todos")}>Ver todos los estados</button>}
      </div>
      <div className="chips" style={{ marginBottom: 14 }}>
        {cats.map((c) => <button key={c} className={`chip ${c === "Todos" ? "" : `kc ${CAT_K[c] ?? "k8"}`}`} aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}
      </div>
      <section className="panel table-wrap">
        {parts.isLoading ? <Loading /> : parts.error ? <ErrorBox error={parts.error} retry={() => parts.refetch()} /> : !list.length ? <Empty>No hay repuestos que coincidan.</Empty> : (
          <table>
            <thead><tr><th className="hide-sm">Código</th><th>Repuesto</th><th className="hide-sm">Ubic.</th><th>Stock</th><th className="r hide-sm">Costo</th><th className="r">Precio</th><th aria-label="Acciones" /></tr></thead>
            <tbody>{list.map((p) => {
              const st = stockState(p), ratio = Math.min(1, p.stock / Math.max(1, p.minStock * 2.5));
              const pill = p.stock === 0 ? <span className="spill st-low out">Agotado</span> : st === "reponer" ? <span className="spill st-low">Reponer</span> : st === "limite" ? <span className="spill st-lim">Al límite</span> : <span className="spill st-ok">Bien</span>;
              return (
                <tr key={p.id} className={`row-click ${p.stock === 0 ? "agotado" : ""}`} onClick={() => setEdit(p)}>
                  <td className="mono hide-sm" style={{ fontSize: 12 }}>{p.code}</td>
                  <td><div>{p.name}</div><div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}><span className={`cat ${CAT_K[p.category] ?? "k8"}`}>{p.category}</span><span className="muted" style={{ fontSize: 12 }}>mínimo {p.minStock}</span></div></td>
                  <td className="hide-sm mono" style={{ fontSize: 12 }}>{p.location}</td>
                  <td><div className="meter"><span className="num" style={{ minWidth: 22, fontWeight: 600 }}>{p.stock}</span><span className="meter-bar"><i className={st === "reponer" ? "low" : st === "limite" ? "mid" : "ok"} style={{ transform: `scaleX(${ratio.toFixed(3)})` }} /></span>{pill}</div></td>
                  <td className="r num hide-sm muted">{money(p.cost)}</td>
                  <td className="r num">{money(p.price)}</td>
                  <td className="r"><button className="btn sm" onClick={(e) => { e.stopPropagation(); setIngreso(p); }} aria-label={`Registrar ingreso de ${p.name}`}><Icon n="plus" /><span className="hide-sm">Ingreso</span></button></td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </section>
      <PartModal part={edit} onClose={() => setEdit(null)} onIngreso={(p) => { setEdit(null); setIngreso(p); }} />
      <IngresoModal part={ingreso} onClose={() => setIngreso(null)} />
    </>
  );
}

const CATS = Object.keys(CAT_K);
type Mv = { id: number; type: string; qty: number; note: string; createdAt: number; userName: string | null; orderId: number | null };
const MV_LABEL: Record<string, string> = { ingreso: "Ingreso", salida: "Usado en orden", devolucion: "Devuelto de orden", ajuste: "Ajuste por conteo" };

function PartModal({ part, onClose, onIngreso }: { part: Part | "new" | null; onClose: () => void; onIngreso: (p: Part) => void }) {
  const isNew = part === "new";
  const p = part && part !== "new" ? part : null;
  const [f, setF] = useState({ code: "", name: "", category: "Lubricantes", cost: "", price: "", minStock: "2", location: "", stock: "0" });
  const [tab, setTab] = useState<"datos" | "movimientos" | "conteo">("datos");
  const [count, setCount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const toast = useToast();
  const mv = useQuery({ queryKey: ["movements", p?.id], queryFn: () => api.get<Mv[]>(`/parts/${p!.id}/movements`), enabled: !!p && tab === "movimientos" });
  useEffect(() => {
    if (!part) return;
    setTab("datos"); setCount(""); setNote("");
    setF(p ? { code: p.code, name: p.name, category: p.category, cost: String(toBs(p.cost ?? 0)), price: String(toBs(p.price ?? 0)), minStock: String(p.minStock), location: p.location, stock: String(p.stock) }
      : { code: "", name: "", category: "Lubricantes", cost: "", price: "", minStock: "2", location: "", stock: "0" });
  }, [part]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const done = (msg: string) => { qc.invalidateQueries({ queryKey: ["parts"] }); qc.invalidateQueries({ queryKey: ["movements"] }); toast(msg); onClose(); };
  const fail = (e: unknown) => toast(e instanceof Error ? e.message : "No se pudo guardar", "error");
  const margin = (parseFloat(f.price) || 0) - (parseFloat(f.cost) || 0);

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const body = { code: f.code, name: f.name, category: f.category, cost: parseFloat(f.cost) || 0, price: parseFloat(f.price) || 0, minStock: parseInt(f.minStock, 10) || 0, location: f.location };
    try {
      if (isNew) await api.post("/parts", { ...body, stock: parseInt(f.stock, 10) || 0 });
      else await api.patch(`/parts/${p!.id}`, body);
      done(isNew ? "Repuesto creado" : "Cambios guardados");
    } catch (err) { fail(err); } finally { setBusy(false); }
  };
  const adjust = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { await api.post(`/parts/${p!.id}/ajuste`, { stock: parseInt(count, 10), note }); done("Stock corregido"); }
    catch (err) { fail(err); } finally { setBusy(false); }
  };
  const deactivate = async () => {
    setBusy(true);
    try { await api.patch(`/parts/${p!.id}`, { active: false }); done("Repuesto quitado del inventario"); }
    catch (err) { fail(err); } finally { setBusy(false); }
  };

  return (
    <Modal open={!!part} onClose={onClose} wide label={isNew ? "Nuevo repuesto" : "Repuesto"}>
      <ModalHead title={isNew ? "Nuevo repuesto" : p?.name} kicker={p ? `${p.code} · quedan ${p.stock}` : undefined} onClose={onClose} />
      {!isNew && <div style={{ padding: "12px 18px 0" }}><Seg full value={tab} onChange={setTab} options={[["datos", "Datos"], ["movimientos", "Movimientos"], ["conteo", "Corregir stock"]]} label="Sección" /></div>}
      {tab === "datos" && (
        <form onSubmit={save} style={{ display: "contents" }}>
          <div className="card-body">
            <div className="grid2">
              <div className="field"><label htmlFor="pt-code">Código</label><input id="pt-code" value={f.code} onChange={set("code")} placeholder="LUB-008" style={{ textTransform: "uppercase" }} /></div>
              <div className="field"><label htmlFor="pt-cat">Categoría</label><select id="pt-cat" value={f.category} onChange={set("category")}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></div>
            </div>
            <div className="field"><label htmlFor="pt-name">Nombre</label><input id="pt-name" value={f.name} onChange={set("name")} placeholder="Ej. Aceite 15W-40 (galón)" /></div>
            <div className="grid2">
              <div className="field"><label htmlFor="pt-cost">Costo (Bs)</label><input id="pt-cost" type="number" inputMode="decimal" min={0} step="0.5" value={f.cost} onChange={set("cost")} /></div>
              <div className="field"><label htmlFor="pt-price">Precio de venta (Bs)</label><input id="pt-price" type="number" inputMode="decimal" min={0} step="0.5" value={f.price} onChange={set("price")} />
                {f.cost && f.price && <span className="hint">Ganas Bs {margin.toLocaleString("es-BO")} por unidad</span>}</div>
              <div className="field"><label htmlFor="pt-min">Stock mínimo</label><input id="pt-min" type="number" inputMode="numeric" min={0} value={f.minStock} onChange={set("minStock")} /></div>
              <div className="field"><label htmlFor="pt-loc">Ubicación en el almacén</label><input id="pt-loc" value={f.location} onChange={set("location")} placeholder="Ej. A1" /></div>
              {isNew && <div className="field"><label htmlFor="pt-stock">Stock inicial</label><input id="pt-stock" type="number" inputMode="numeric" min={0} value={f.stock} onChange={set("stock")} /></div>}
            </div>
          </div>
          <div className="card-foot">
            {!isNew && <button type="button" className="link-btn quiet note" style={{ color: "var(--crit)" }} disabled={busy} onClick={deactivate}>Quitar del inventario</button>}
            {!isNew && <button type="button" className="btn" onClick={() => onIngreso(p!)}><Icon n="plus" />Registrar ingreso</button>}
            <button className="btn primary" disabled={busy}>{isNew ? "Crear repuesto" : "Guardar"}</button>
          </div>
        </form>
      )}
      {tab === "movimientos" && (
        <div className="card-body">
          {mv.isLoading ? <Loading /> : !mv.data?.length ? <Empty>Sin movimientos todavía.</Empty> : (
            <div className="panel list">{mv.data.map((m) => (
              <div key={m.id} className="list-row"><div className="grow"><div className="t" style={{ fontSize: 13 }}>{MV_LABEL[m.type] ?? m.type}{m.note ? ` · ${m.note}` : ""}</div><div className="s">{when(m.createdAt)}{m.userName ? ` · ${m.userName}` : ""}</div></div>
                <span className="num" style={{ fontWeight: 600, color: m.qty > 0 ? "var(--good)" : "var(--crit)" }}>{m.qty > 0 ? "+" : ""}{m.qty}</span></div>
            ))}</div>
          )}
        </div>
      )}
      {tab === "conteo" && (
        <form onSubmit={adjust} style={{ display: "contents" }}>
          <div className="card-body">
            <p className="muted">Si al contar el almacén hay una cantidad distinta a la del sistema, escribe lo que contaste. Queda registrado quién lo corrigió y por qué.</p>
            <div className="grid2">
              <div className="field"><label htmlFor="ad-count">Cantidad contada</label><input id="ad-count" type="number" inputMode="numeric" min={0} value={count} onChange={(e) => setCount(e.target.value)} placeholder={`En el sistema: ${p?.stock ?? 0}`} /></div>
              <div className="field"><label htmlFor="ad-note">Motivo</label><input id="ad-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej. Conteo de fin de mes" /></div>
            </div>
          </div>
          <div className="card-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={busy || count === "" || note.trim().length < 3}>Corregir stock</button></div>
        </form>
      )}
    </Modal>
  );
}

function IngresoModal({ part, onClose }: { part: Part | null; onClose: () => void }) {
  const [qty, setQty] = useState("1");
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const toast = useToast();
  useEffect(() => { if (part) { setQty("1"); setCost(String(toBs(part.cost ?? 0))); setPrice(String(toBs(part.price ?? 0))); } }, [part]);
  const c = parseFloat(cost) || 0, pr = parseFloat(price) || 0;
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      await api.post(`/parts/${part!.id}/ingreso`, { qty: parseInt(qty, 10), cost: c, price: pr });
      qc.invalidateQueries({ queryKey: ["parts"] });
      toast(`Ingreso guardado: ${qty} × ${part!.name}`);
      onClose();
    } catch (err) { toast(err instanceof Error ? err.message : "No se pudo guardar", "error"); }
    finally { setBusy(false); }
  };
  return (
    <Modal open={!!part} onClose={onClose} label="Registrar ingreso">
      <ModalHead title="Registrar ingreso" kicker={part ? `${part.code} · ${part.name}` : undefined} onClose={onClose} />
      <form onSubmit={save} style={{ display: "contents" }}>
        <div className="card-body">
          <div className="grid2">
            <div className="field"><label htmlFor="in-qty">Cantidad que entra</label><input id="in-qty" type="number" inputMode="numeric" min={1} value={qty} onChange={(e) => setQty(e.target.value)} autoFocus /></div>
            <div className="field"><label htmlFor="in-cost">Costo unitario (Bs)</label><input id="in-cost" type="number" inputMode="decimal" min={0} step="0.5" value={cost} onChange={(e) => setCost(e.target.value)} /></div>
          </div>
          <div className="field"><label htmlFor="in-price">Precio de venta (Bs)</label><input id="in-price" type="number" inputMode="decimal" min={0} step="0.5" value={price} onChange={(e) => setPrice(e.target.value)} />
            <span className="hint">{c > 0 ? `Ganas ${money(Math.round((pr - c) * 100))} por unidad (${Math.round(((pr - c) / c) * 100)} % sobre el costo)` : ""}</span></div>
        </div>
        <div className="card-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={busy || !(parseInt(qty, 10) > 0)}>Guardar ingreso</button></div>
      </form>
    </Modal>
  );
}
