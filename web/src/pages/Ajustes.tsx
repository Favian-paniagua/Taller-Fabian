import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Icon } from "../lib/icons";
import { useSettings } from "../lib/queries";
import { avClass, initials, when } from "../lib/format";
import type { Settings } from "../lib/types";
import { Empty, ErrorBox, Loading, Modal, ModalHead, Seg, useToast } from "../components/ui";

type Tab = "usuarios" | "taller" | "copias" | "cuenta";

export default function Ajustes() {
  const { user } = useAuth();
  const admin = user!.role === "admin";
  const [tab, setTab] = useState<Tab>(admin ? "usuarios" : "cuenta");
  return (
    <>
      <div className="page-head"><div><h1>{admin ? "Ajustes" : "Mi cuenta"}</h1><p>{admin ? "Mecánicos, datos del taller y copias de seguridad" : "Tu usuario y contraseña"}</p></div></div>
      {admin && <div style={{ marginBottom: 16, overflowX: "auto" }}><Seg value={tab} onChange={setTab} options={[["usuarios", "Mecánicos"], ["taller", "Datos del taller"], ["copias", "Copias de seguridad"], ["cuenta", "Mi cuenta"]]} label="Sección" /></div>}
      {tab === "usuarios" && <Usuarios />}
      {tab === "taller" && <Taller />}
      {tab === "copias" && <Copias />}
      {tab === "cuenta" && <Cuenta />}
    </>
  );
}

type U = { id: number; name: string; username: string; role: "admin" | "mecanico"; specialty: string; active: boolean; activeOrders: number };

function Usuarios() {
  const list = useQuery({ queryKey: ["users"], queryFn: () => api.get<U[]>("/users") });
  const [edit, setEdit] = useState<U | "new" | null>(null);
  const [pass, setPass] = useState<U | null>(null);
  return (
    <section className="panel" style={{ maxWidth: 820 }}>
      <div className="panel-head"><div><h2>Mecánicos y usuarios</h2><span className="sub">Cada mecánico entra con su usuario desde su celular y ve solo sus trabajos, sin precios ni caja.</span></div>
        <button className="btn sm primary" onClick={() => setEdit("new")}><Icon n="plus" />Agregar mecánico</button></div>
      {list.isLoading ? <Loading /> : list.error ? <ErrorBox error={list.error} /> : (
        <div className="list">{list.data!.map((u) => (
          <div key={u.id} className="list-row" style={{ opacity: u.active ? 1 : 0.55 }}>
            <span className={`av lg ${avClass(u.id)}`}>{initials(u.name)}</span>
            <div className="grow"><div className="t">{u.name} <span className="tag">{u.role === "admin" ? "Administrador" : "Mecánico"}</span>{!u.active && <span className="tag low" style={{ marginLeft: 6 }}>Desactivado</span>}</div>
              <div className="s">Usuario: {u.username}{u.specialty ? ` · ${u.specialty}` : ""}{u.role === "mecanico" ? ` · ${u.activeOrders} en el taller` : ""}</div></div>
            <button className="btn sm" onClick={() => setPass(u)}>Contraseña</button>
            <button className="icon-btn" onClick={() => setEdit(u)} aria-label={`Editar ${u.name}`}><Icon n="edit" /></button>
          </div>
        ))}</div>
      )}
      <UserModal user={edit} onClose={() => setEdit(null)} />
      <PasswordModal user={pass} onClose={() => setPass(null)} />
    </section>
  );
}

function UserModal({ user, onClose }: { user: U | "new" | null; onClose: () => void }) {
  const isNew = user === "new";
  const u = user && user !== "new" ? user : null;
  const [f, setF] = useState({ name: "", username: "", specialty: "", role: "mecanico" as U["role"], password: "", active: true });
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const toast = useToast();
  useEffect(() => { if (user) setF(u ? { name: u.name, username: u.username, specialty: u.specialty, role: u.role, password: "", active: u.active } : { name: "", username: "", specialty: "", role: "mecanico", password: "", active: true }); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      if (isNew) await api.post("/users", f);
      else await api.patch(`/users/${u!.id}`, { name: f.name, username: f.username, specialty: f.specialty, role: f.role, active: f.active });
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["mechanics"] });
      toast(isNew ? `${f.name} ya puede entrar con su usuario` : "Cambios guardados");
      onClose();
    } catch (err) { toast(err instanceof Error ? err.message : "No se pudo guardar", "error"); }
    finally { setBusy(false); }
  };
  return (
    <Modal open={!!user} onClose={onClose} label={isNew ? "Agregar mecánico" : "Editar usuario"}>
      <ModalHead title={isNew ? "Agregar mecánico" : "Editar usuario"} onClose={onClose} />
      <form onSubmit={save} style={{ display: "contents" }}>
        <div className="card-body">
          <div className="field"><label htmlFor="us-name">Nombre completo</label><input id="us-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="grid2">
            <div className="field"><label htmlFor="us-user">Usuario para entrar</label><input id="us-user" value={f.username} autoCapitalize="none" onChange={(e) => setF({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, "") })} placeholder="Ej. jhonny" /></div>
            <div className="field"><label htmlFor="us-spec">Especialidad</label><input id="us-spec" value={f.specialty} onChange={(e) => setF({ ...f, specialty: e.target.value })} placeholder="Ej. Electricidad y motos" /></div>
          </div>
          {isNew && <div className="field"><label htmlFor="us-pass">Contraseña inicial</label><input id="us-pass" type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="Mínimo 6 caracteres" /><span className="hint">Dísela al mecánico; después puede cambiarla en Mi cuenta.</span></div>}
          <div className="field"><span className="lbl">Rol</span><Seg value={f.role} onChange={(r) => setF({ ...f, role: r })} options={[["mecanico", "Mecánico"], ["admin", "Administrador"]]} label="Rol" />
            <span className="hint">{f.role === "admin" ? "Ve y hace todo: precios, caja, resumen y ajustes." : "Ve solo sus trabajos, anota lo que hace falta y marca cuándo termina."}</span></div>
          {!isNew && <label className="check"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Puede entrar al sistema</label>}
        </div>
        <div className="card-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={busy}>{isNew ? "Agregar" : "Guardar"}</button></div>
      </form>
    </Modal>
  );
}

function PasswordModal({ user, onClose }: { user: U | null; onClose: () => void }) {
  const [p, setP] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => { if (user) setP(""); }, [user]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { await api.post(`/users/${user!.id}/password`, { password: p }); toast(`Contraseña de ${user!.name} cambiada`); onClose(); }
    catch (err) { toast(err instanceof Error ? err.message : "No se pudo cambiar", "error"); }
    finally { setBusy(false); }
  };
  return (
    <Modal open={!!user} onClose={onClose} label="Nueva contraseña">
      <ModalHead title="Nueva contraseña" kicker={user?.name} onClose={onClose} />
      <form onSubmit={save} style={{ display: "contents" }}>
        <div className="card-body"><div className="field"><label htmlFor="np">Contraseña nueva</label><input id="np" type="text" value={p} onChange={(e) => setP(e.target.value)} placeholder="Mínimo 6 caracteres" /><span className="hint">Se cierra su sesión en los demás equipos.</span></div></div>
        <div className="card-foot"><button type="button" className="btn ghost" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={busy || p.length < 6}>Cambiar</button></div>
      </form>
    </Modal>
  );
}

function Taller() {
  const s = useSettings();
  const [f, setF] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const toast = useToast();
  useEffect(() => { if (s.data) setF(s.data); }, [s.data]);
  if (!f) return <Loading />;
  const set = (k: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { const r = await api.put<Settings>("/settings", f); qc.setQueryData(["settings"], r); toast("Datos del taller guardados"); }
    catch (err) { toast(err instanceof Error ? err.message : "No se pudo guardar", "error"); }
    finally { setBusy(false); }
  };
  return (
    <form className="panel" style={{ maxWidth: 820 }} onSubmit={save}>
      <div className="panel-head"><div><h2>Datos del taller</h2><span className="sub">Aparecen en la nota de venta y en los mensajes</span></div></div>
      <div className="panel-body" style={{ display: "grid", gap: 14 }}>
        <div className="grid2">
          <div className="field"><label htmlFor="st-name">Nombre del taller</label><input id="st-name" value={f.businessName} onChange={set("businessName")} /></div>
          <div className="field"><label htmlFor="st-tag">Especialidades</label><input id="st-tag" value={f.tagline} onChange={set("tagline")} /></div>
          <div className="field"><label htmlFor="st-phone">Celular del taller</label><input id="st-phone" value={f.phone} onChange={set("phone")} inputMode="tel" /></div>
          <div className="field"><label htmlFor="st-addr">Dirección</label><input id="st-addr" value={f.address} onChange={set("address")} /></div>
        </div>
        <div className="field"><label htmlFor="st-note">Nota al pie de la nota de venta</label><input id="st-note" value={f.receiptNote} onChange={set("receiptNote")} /></div>
        <div><button className="btn primary" disabled={busy}>Guardar</button></div>
      </div>
    </form>
  );
}

type B = { folder: string; extraFolder: string; keep: number; list: { name: string; size: number; createdAt: number }[] };
function Copias() {
  const q = useQuery({ queryKey: ["backups"], queryFn: () => api.get<B>("/backups") });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const now = async () => {
    setBusy(true);
    try { await api.post("/backups"); await q.refetch(); toast("Copia de seguridad guardada"); }
    catch (e) { toast(e instanceof Error ? e.message : "No se pudo crear la copia", "error"); }
    finally { setBusy(false); }
  };
  const d = q.data;
  return (
    <section className="panel" style={{ maxWidth: 820 }}>
      <div className="panel-head"><div><h2>Copias de seguridad</h2><span className="sub">El sistema guarda una copia automática cada día y conserva las últimas {d?.keep ?? 30}.</span></div>
        <button className="btn sm primary" disabled={busy} onClick={now}>{busy ? "Guardando…" : "Hacer una copia ahora"}</button></div>
      {d && <div className="panel-body muted" style={{ fontSize: 13, display: "grid", gap: 4 }}>
        <span>Carpeta: <span className="mono">{d.folder}</span></span>
        <span>{d.extraFolder ? <>Segunda copia en: <span className="mono">{d.extraFolder}</span></> : "Recomendado: guarda también una copia fuera de la PC (memoria USB o Google Drive). La guía de instalación explica cómo."}</span>
      </div>}
      {q.isLoading ? <Loading /> : q.error ? <ErrorBox error={q.error} /> : !d!.list.length ? <Empty>Todavía no hay copias. La primera se hace sola a los pocos segundos de encender el sistema.</Empty> : (
        <div className="list" style={{ borderTop: "1px solid var(--line)" }}>{d!.list.map((b) => (
          <div key={b.name} className="list-row"><div className="grow"><div className="t" style={{ fontSize: 13 }}>{when(b.createdAt)}</div><div className="s mono">{b.name} · {(b.size / 1024 / 1024).toFixed(1)} MB</div></div>
            <a className="btn sm" href={`/api/backups/${encodeURIComponent(b.name)}`} download><Icon n="download" />Descargar</a></div>
        ))}</div>
      )}
    </section>
  );
}

function Cuenta() {
  const { user, logout } = useAuth();
  const [f, setF] = useState({ current: "", next: "", again: "" });
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.next !== f.again) return toast("Las dos contraseñas nuevas no coinciden", "info");
    setBusy(true);
    try { await api.post("/auth/password", { current: f.current, next: f.next }); setF({ current: "", next: "", again: "" }); toast("Contraseña cambiada"); }
    catch (err) { toast(err instanceof Error ? err.message : "No se pudo cambiar", "error"); }
    finally { setBusy(false); }
  };
  return (
    <form className="panel" style={{ maxWidth: 560 }} onSubmit={save}>
      <div className="panel-head"><div><h2>{user!.name}</h2><span className="sub">Usuario: {user!.username} · {user!.role === "admin" ? "Administrador" : "Mecánico"}</span></div><button type="button" className="btn sm" onClick={logout}><Icon n="logout" />Cerrar sesión</button></div>
      <div className="panel-body" style={{ display: "grid", gap: 14 }}>
        <div className="field"><label htmlFor="pw-cur">Contraseña actual</label><input id="pw-cur" type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} /></div>
        <div className="grid2">
          <div className="field"><label htmlFor="pw-new">Contraseña nueva</label><input id="pw-new" type="password" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} placeholder="Mínimo 6 caracteres" /></div>
          <div className="field"><label htmlFor="pw-again">Repite la nueva</label><input id="pw-again" type="password" autoComplete="new-password" value={f.again} onChange={(e) => setF({ ...f, again: e.target.value })} /></div>
        </div>
        <div><button className="btn primary" disabled={busy || !f.current || f.next.length < 6}>Cambiar contraseña</button></div>
      </div>
    </form>
  );
}
