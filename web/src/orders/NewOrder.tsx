import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Icon } from "../lib/icons";
import { useMechanics } from "../lib/queries";
import { FUEL, num, OBJECTS, plateTxt } from "../lib/format";
import type { OrderDetail } from "../lib/types";
import { Empty, Loading, Modal, Plate, Seg, reduceMotion, useToast } from "../components/ui";

type Found = { id: number; plate: string; brand: string; model: string; year: number | null; type: "auto" | "moto"; km: number; clientId: number; clientName: string; inShop: boolean };
type ClientFound = { id: number; name: string; phone: string; vehicles: { plate: string }[] };

const emptyDraft = { plate: "", year: "", brand: "", model: "", name: "", phone: "", reason: "", km: "" };

export default function NewOrder({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: number) => void }) {
  const [step, setStep] = useState(1);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Found | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [type, setType] = useState<"auto" | "moto">("auto");
  const [who, setWho] = useState<"nuevo" | "registrado">("nuevo");
  const [cq, setCq] = useState("");
  const [client, setClient] = useState<ClientFound | null>(null);
  const [d, setD] = useState(emptyDraft);
  const [fuel, setFuel] = useState("2");
  const [objects, setObjects] = useState<string[]>(["Gata", "Llanta de auxilio"]);
  const [mech, setMech] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const qc = useQueryClient();
  const mechanics = useMechanics().data ?? [];

  useEffect(() => {
    if (!open) return;
    setStep(1); setQ(""); setPicked(null); setIsNew(false); setType("auto"); setWho("nuevo"); setCq(""); setClient(null);
    setD(emptyDraft); setFuel("2"); setObjects(["Gata", "Llanta de auxilio"]); setMech("");
  }, [open]);

  const search = useQuery({ queryKey: ["vsearch", q.trim()], queryFn: () => api.get<Found[]>(`/vehicles/search?q=${encodeURIComponent(q.trim())}`), enabled: open && step === 1 && !isNew, staleTime: 5e3 });
  const csearch = useQuery({ queryKey: ["csearch", cq.trim()], queryFn: () => api.get<ClientFound[]>(`/clients?q=${encodeURIComponent(cq.trim())}`), enabled: open && isNew && who === "registrado" && cq.trim().length > 1 });

  const set = (k: keyof typeof emptyDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setD((x) => ({ ...x, [k]: e.target.value }));
  const animate = (dir: number) => requestAnimationFrame(() => body.current?.animate(
    [{ opacity: 0, transform: `translateX(${reduceMotion() ? 0 : dir * 20}px)` }, { opacity: 1, transform: "none" }],
    { duration: 240, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }));
  const pickMechanic = (vType: "auto" | "moto") => {
    if (mech) return;
    const m = vType === "moto" ? mechanics.find((x) => /moto/i.test(x.specialty)) : mechanics.find((x) => !/moto/i.test(x.specialty));
    setMech(m ? String(m.id) : mechanics[0] ? String(mechanics[0].id) : "");
  };

  const next = () => {
    if (isNew) {
      const plate = d.plate.toUpperCase().replace(/[^0-9A-Z]/g, "");
      if (plate.length < 5 || !d.brand.trim() || !d.model.trim()) return toast("Completa placa, marca y modelo", "info");
      if (who === "nuevo" && (!d.name.trim() || d.phone.replace(/\D/g, "").length !== 8)) return toast("Escribe el nombre y un celular de 8 dígitos", "info");
      if (who === "registrado" && !client) return toast("Elige el cliente de la lista", "info");
      pickMechanic(type);
    } else {
      if (!picked) return toast("Elige un vehículo de la lista", "info");
      if (picked.inShop) return toast("Ese vehículo ya está en el taller", "info");
      pickMechanic(picked.type);
    }
    setStep(2); animate(1);
  };
  const back = () => { setStep(1); animate(-1); };

  const create = async () => {
    if (d.reason.trim().length < 2) { document.getElementById("no-reason")?.focus(); return toast("Escribe lo que dice el cliente", "info"); }
    setBusy(true);
    try {
      const km = d.km ? parseInt(d.km, 10) : null;
      const payload = {
        reason: d.reason.trim(), km, fuel: Number(fuel), objects, mechanicId: mech ? Number(mech) : null,
        ...(isNew ? {
          newVehicle: {
            type, plate: d.plate, brand: d.brand, model: d.model, year: d.year ? parseInt(d.year, 10) : null,
            ...(who === "registrado" ? { clientId: client!.id } : { newClient: { name: d.name, phone: d.phone } }),
          },
        } : { vehicleId: picked!.id }),
      };
      const o = await api.post<OrderDetail>("/orders", payload);
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["vsearch"] });
      toast(`Orden abierta para ${plateTxt(o.vehicle.plate)}`);
      onCreated(o.id);
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo abrir la orden", "error");
    } finally {
      setBusy(false);
    }
  };

  const who2 = picked ? { plate: picked.plate, name: `${picked.brand} ${picked.model} ${picked.year ?? ""}`, cl: picked.clientName, km: picked.km }
    : { plate: d.plate.toUpperCase().replace(/[^0-9A-Z]/g, ""), name: `${d.brand} ${d.model} ${d.year}`, cl: who === "registrado" ? client?.name ?? "" : d.name, km: 0 };

  return (
    <Modal open={open} onClose={onClose} wide label="Nueva orden de trabajo">
      <div className="card-head">
        <h2><span className="kicker">Paso {step} de 2</span>{step === 1 ? "¿Qué vehículo llegó?" : "Datos de la recepción"}</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><Icon n="x" /></button>
      </div>
      <div className="wiz-bar" aria-hidden="true"><i className="on" /><i className={step === 2 ? "on" : ""} /></div>
      <form onSubmit={(e) => { e.preventDefault(); step === 1 ? next() : create(); }} style={{ display: "contents" }}>
        <div className="card-body" ref={body}>
          {step === 1 && !isNew && (<>
            <div className="field">
              <label htmlFor="no-q">Busca por placa o nombre del cliente</label>
              <label className="search" style={{ maxWidth: "none" }}><Icon n="search" /><input id="no-q" value={q} onChange={(e) => { setQ(e.target.value); setPicked(null); }} placeholder="Ej. 2847 o Mamani" autoComplete="off" autoFocus /></label>
            </div>
            <div className="pick-list" style={{ maxHeight: 260 }}>
              {!q.trim() && <div className="pick-cap">Clientes recientes</div>}
              {search.isLoading ? <Loading /> : (search.data ?? []).length ? search.data!.map((v) => (
                <button type="button" key={v.id} className={`pick ${picked?.id === v.id ? "sel" : ""}`} onClick={() => setPicked(v)}>
                  <Plate plate={v.plate} />
                  <span className="grow"><span className="t">{v.brand} {v.model} {v.year ?? ""}</span><span className="s">{v.clientName}{v.inShop ? " · ya está en el taller" : ""}</span></span>
                  <span className="ok"><Icon n="check" /></span>
                </button>
              )) : <Empty pad={16}>{q.trim() ? "No se encontró. Regístralo como vehículo nuevo." : "Todavía no hay vehículos registrados."}</Empty>}
            </div>
            <button type="button" className="link-btn" style={{ fontSize: 14, justifySelf: "start" }} onClick={() => { setIsNew(true); setPicked(null); }}>+ Es un vehículo nuevo</button>
          </>)}

          {step === 1 && isNew && (<>
            <button type="button" className="link-btn" style={{ fontSize: 14, justifySelf: "start" }} onClick={() => setIsNew(false)}>← Buscar un vehículo registrado</button>
            <div className="newveh">
              <div className="field"><span className="lbl">Tipo</span><Seg value={type} onChange={setType} options={[["auto", "Auto"], ["moto", "Moto"]]} label="Tipo de vehículo" /></div>
              <div className="grid2">
                <div className="field"><label htmlFor="nv-plate">Placa</label><input id="nv-plate" value={d.plate} onChange={set("plate")} placeholder="Ej. 4512KHT" maxLength={9} style={{ textTransform: "uppercase" }} autoFocus /></div>
                <div className="field"><label htmlFor="nv-year">Año</label><input id="nv-year" type="number" inputMode="numeric" value={d.year} onChange={set("year")} placeholder="2015" /></div>
                <div className="field"><label htmlFor="nv-brand">Marca</label><input id="nv-brand" value={d.brand} onChange={set("brand")} placeholder="Toyota" /></div>
                <div className="field"><label htmlFor="nv-model">Modelo</label><input id="nv-model" value={d.model} onChange={set("model")} placeholder="Corolla" /></div>
              </div>
              <div className="field"><span className="lbl">Dueño del vehículo</span><Seg value={who} onChange={(v) => { setWho(v); setClient(null); }} options={[["nuevo", "Cliente nuevo"], ["registrado", "Ya es cliente"]]} label="Cliente" /></div>
              {who === "nuevo" ? (
                <div className="grid2">
                  <div className="field"><label htmlFor="nc-name">Nombre del cliente</label><input id="nc-name" value={d.name} onChange={set("name")} placeholder="Nombre y apellido" /></div>
                  <div className="field"><label htmlFor="nc-phone">Celular (WhatsApp)</label><input id="nc-phone" value={d.phone} onChange={set("phone")} inputMode="tel" maxLength={8} placeholder="71234567" /></div>
                </div>
              ) : (<>
                <label className="search" style={{ maxWidth: "none" }}><Icon n="search" /><input value={cq} onChange={(e) => { setCq(e.target.value); setClient(null); }} placeholder="Nombre, CI o celular" aria-label="Buscar cliente" /></label>
                {cq.trim().length > 1 && <div className="pick-list" style={{ maxHeight: 200 }}>
                  {csearch.isLoading ? <Loading /> : (csearch.data ?? []).slice(0, 6).map((c) => (
                    <button type="button" key={c.id} className={`pick ${client?.id === c.id ? "sel" : ""}`} onClick={() => setClient(c)}>
                      <span className="grow"><span className="t">{c.name}</span><span className="s">{c.phone || "sin celular"} · {c.vehicles.length} {c.vehicles.length === 1 ? "vehículo" : "vehículos"}</span></span>
                      <span className="ok"><Icon n="check" /></span>
                    </button>
                  ))}
                  {csearch.data && !csearch.data.length && <Empty pad={16}>No se encontró el cliente.</Empty>}
                </div>}
              </>)}
            </div>
          </>)}

          {step === 2 && (<>
            <div className="chosen"><Plate plate={who2.plate} /><div className="grow"><div className="t">{who2.name}</div><div className="s">{who2.cl}</div></div><button type="button" className="link-btn" onClick={back}>Cambiar</button></div>
            <div className="field"><label htmlFor="no-reason">¿Qué dice el cliente que tiene?</label><textarea id="no-reason" value={d.reason} onChange={set("reason")} placeholder="Por ejemplo: hace ruido al frenar" autoFocus /></div>
            <div className="grid2">
              <div className="field"><label htmlFor="no-km">Kilometraje</label><input id="no-km" type="number" inputMode="numeric" value={d.km} onChange={set("km")} placeholder={who2.km ? `Último: ${num(who2.km)}` : "Ej. 125400"} /></div>
              <div className="field"><label htmlFor="no-mech">Mecánico</label>
                <select id="no-mech" value={mech} onChange={(e) => setMech(e.target.value)}>
                  <option value="">Sin asignar por ahora</option>
                  {mechanics.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>
            <div className="field"><span className="lbl">Combustible</span><Seg full value={fuel} onChange={setFuel} options={FUEL.map((f, i) => [String(i), f] as [string, string])} label="Combustible" /></div>
            <div className="field"><span className="lbl">Objetos que deja en el vehículo</span>
              <div className="toggle-chips">{OBJECTS.map((x) => (
                <button type="button" key={x} className="chip" aria-pressed={objects.includes(x)} onClick={() => setObjects((l) => (l.includes(x) ? l.filter((y) => y !== x) : [...l, x]))}>{x}</button>
              ))}</div>
            </div>
          </>)}
        </div>
        <div className="card-foot">
          {step === 1 ? (<>
            <button type="button" className="btn ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn primary" disabled={!isNew && !picked}>Siguiente<Icon n="arrow" /></button>
          </>) : (<>
            <button type="button" className="btn ghost" onClick={back}><Icon n="back" />Atrás</button>
            <button type="submit" className="btn primary" disabled={busy}><Icon n="check" />{busy ? "Abriendo…" : "Abrir orden"}</button>
          </>)}
        </div>
      </form>
    </Modal>
  );
}
