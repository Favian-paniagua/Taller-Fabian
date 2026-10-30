import { useAuth } from "../lib/auth";
import { Icon } from "../lib/icons";
import { usePanels } from "../lib/panels";
import { useActiveOrders, useCashToday, useParts } from "../lib/queries";
import { STEPS } from "../lib/steps";
import { ago, avClass, cap, firstName, initials, money } from "../lib/format";
import { ErrorBox, Loading, Plate } from "../components/ui";
import type { OrderSummary } from "../lib/types";
import { useNavigate } from "react-router-dom";

function OrderCard({ o, admin }: { o: OrderSummary; admin: boolean }) {
  const { openOrder } = usePanels();
  let right: React.ReactNode = ago(o.createdAt);
  if (o.state === "revision" && o.itemsCount) right = `${o.itemsCount} ${o.itemsCount === 1 ? "trabajo" : "trabajos"}`;
  if (admin && (o.state === "presupuesto" || o.state === "listo")) right = <span className="amt">{money(o.total)}</span>;
  return (
    <button className="ot-card" onClick={() => openOrder(o.id)}>
      <span className="top"><Plate plate={o.vehicle.plate} />{o.mechanic && <span className={`av ${avClass(o.mechanic.id)}`} title={o.mechanic.name}>{initials(o.mechanic.name)}</span>}</span>
      <span className="veh">{o.vehicle.brand} {o.vehicle.model}</span>
      {o.waiting && <span><span className="tag wait">Esperando repuesto</span></span>}
      <span className="meta"><span>{admin ? firstName(o.client.name) : o.reason}</span><span>{right}</span></span>
    </button>
  );
}

export default function Taller() {
  const { user } = useAuth();
  const admin = user!.role === "admin";
  const q = useActiveOrders();
  const cash = useCashToday(admin).data;
  const parts = useParts().data;
  const { newOrder } = usePanels();
  const navigate = useNavigate();
  const act = q.data ?? [];
  const listos = act.filter((o) => o.state === "listo").length;
  const hour = new Date().getHours();
  const hi = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const fecha = cap(new Date().toLocaleDateString("es-BO", { weekday: "long", day: "numeric", month: "long" }));
  const low = (parts ?? []).filter((p) => p.active && p.stock < p.minStock);
  const mechs = new Map<number, { name: string; n: number; working: number }>();
  for (const o of act) if (o.mechanic) {
    const m = mechs.get(o.mechanic.id) ?? { name: o.mechanic.name, n: 0, working: 0 };
    m.n++; if (o.state === "reparacion" && !o.waiting) m.working++;
    mechs.set(o.mechanic.id, m);
  }
  const unassigned = act.filter((o) => !o.mechanic).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{hi}, {firstName(user!.name)}</h1>
          <div className="today">
            <span>{fecha}</span>
            <span><b>{act.length}</b> {admin ? "en el taller" : act.length === 1 ? "trabajo asignado" : "trabajos asignados"}</span>
            <span className={listos ? "ok" : ""}><b>{listos}</b> listos para entregar</span>
            {admin && <span><b>{money((cash?.cash ?? 0) + (cash?.qr ?? 0))}</b> cobrados hoy</span>}
          </div>
        </div>
        {admin && <button className="btn primary hide-sm" onClick={newOrder}><Icon n="plus" />Nueva orden</button>}
      </div>

      {q.isLoading ? <Loading rows={4} /> : q.error ? <ErrorBox error={q.error} retry={() => q.refetch()} /> : (
        <div className="board">
          {STEPS.map((st) => {
            const list = act.filter((o) => o.state === st.id).sort((a, b) => a.createdAt - b.createdAt);
            return (
              <section key={st.id} className={`col ${st.cls}`} aria-label={`Paso ${st.n}: ${st.label}`}>
                <div className="col-head"><span className="n">{st.n}</span><h3>{st.label}</h3><span className="c">{list.length}</span><p>{st.col}</p></div>
                {list.length ? list.map((o) => <OrderCard key={o.id} o={o} admin={admin} />) : <div className="col-empty">Nada aquí por ahora</div>}
              </section>
            );
          })}
        </div>
      )}

      {admin && (
        <div className="duo">
          <section className="panel">
            <div className="panel-head"><div><h2>Mecánicos</h2><span className="sub">Vehículos asignados ahora</span></div></div>
            <div className="list">
              {[...mechs.entries()].map(([id, m]) => (
                <div key={id} className="list-row">
                  <span className={`av lg ${avClass(id)}`}>{initials(m.name)}</span>
                  <div className="grow"><div className="t">{m.name}</div></div>
                  <div style={{ textAlign: "right" }}><div className="t num">{m.n}</div><div className="s">{m.working} en reparación</div></div>
                </div>
              ))}
              {unassigned > 0 && <div className="list-row"><span className="av lg" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>?</span><div className="grow"><div className="t">Sin asignar</div></div><div className="t num">{unassigned}</div></div>}
              {!mechs.size && !unassigned && <div className="empty">No hay vehículos en el taller</div>}
            </div>
          </section>
          <section className="panel">
            <div className="panel-head"><div><h2>Repuestos por reponer</h2><span className="sub">Debajo del stock mínimo</span></div><button className="btn sm ghost" onClick={() => navigate("/inventario?estado=reponer")}>Ver todos</button></div>
            <div className="list">
              {low.slice(0, 4).map((p) => (
                <div key={p.id} className="list-row"><div className="grow"><div className="t" style={{ fontSize: 13 }}>{p.name}</div><div className="s mono">{p.code}</div></div><span className="tag low num">{p.stock === 0 ? "Agotado" : `Quedan ${p.stock}`}</span></div>
              ))}
              {!low.length && <div className="empty">Todo el stock está sobre el mínimo</div>}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
