import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { Icon, type IconName } from "./lib/icons";
import { PanelsCtx } from "./lib/panels";
import { useActiveOrders, useParts, useSettings } from "./lib/queries";
import { ThemeSwitch } from "./lib/theme";
import { initials } from "./lib/format";
import { Modal, ModalHead } from "./components/ui";
import Login from "./pages/Login";
import Taller from "./pages/Taller";
import Resumen from "./pages/Resumen";
import Historial from "./pages/Historial";
import Inventario from "./pages/Inventario";
import Clientes from "./pages/Clientes";
import Tarifario from "./pages/Tarifario";
import Ajustes from "./pages/Ajustes";
import OrderSheet from "./orders/OrderSheet";
import ClientSheet from "./orders/ClientSheet";
import NewOrder from "./orders/NewOrder";

type NavItem = { to: string; label: string; icon: IconName };
const ADMIN_NAV: NavItem[] = [
  { to: "/", label: "Taller", icon: "home" },
  { to: "/resumen", label: "Resumen", icon: "chart" },
  { to: "/historial", label: "Historial", icon: "ot" },
  { to: "/inventario", label: "Inventario", icon: "box" },
  { to: "/clientes", label: "Clientes", icon: "users" },
  { to: "/tarifario", label: "Tarifario", icon: "tag" },
  { to: "/ajustes", label: "Ajustes", icon: "gear" },
];
const MECH_NAV: NavItem[] = [
  { to: "/", label: "Mis trabajos", icon: "wrench" },
  { to: "/ajustes", label: "Mi cuenta", icon: "gear" },
];

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="boot" aria-busy="true" />;
  if (!user) return <Login />;
  return <Shell />;
}

function Shell() {
  const { user, logout } = useAuth();
  const admin = user!.role === "admin";
  const nav = admin ? ADMIN_NAV : MECH_NAV;
  const settings = useSettings().data;
  const orders = useActiveOrders().data;
  const parts = useParts().data;
  const low = admin ? parts?.filter((p) => p.active && p.stock < p.minStock).length ?? 0 : 0;
  const loc = useLocation();
  const navigate = useNavigate();

  const [orderId, setOrderId] = useState<number | null>(null);
  const [clientId, setClientId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [more, setMore] = useState(false);
  const panels = useMemo(() => ({
    openOrder: (id: number) => { setClientId(null); setOrderId(id); },
    openClient: (id: number) => { setOrderId(null); setClientId(id); },
    newOrder: () => { setOrderId(null); setClientId(null); setCreating(true); },
  }), []);
  const closeOrder = useCallback(() => setOrderId(null), []);
  const closeClient = useCallback(() => setClientId(null), []);

  useEffect(() => { setMore(false); window.scrollTo(0, 0); }, [loc.pathname]);
  useEffect(() => { document.title = settings?.businessName ?? "Taller Mecánico Fabián"; }, [settings?.businessName]);

  const count = (to: string) => (to === "/" ? orders?.length : to === "/inventario" ? low || undefined : undefined);
  const tabs: (NavItem | "new" | "more")[] = admin ? [ADMIN_NAV[0], ADMIN_NAV[1], "new", ADMIN_NAV[3], "more"] : MECH_NAV;
  const moreItems = ADMIN_NAV.filter((n) => ["/historial", "/clientes", "/tarifario", "/ajustes"].includes(n.to));

  return (
    <PanelsCtx.Provider value={panels}>
      <div className="app">
        <aside className="side" aria-label="Menú principal">
          <div className="brand">
            <span className="logo-chip"><img src="/logo.png" alt="" /></span>
            <span><b>{settings?.businessName ?? "Taller Mecánico Fabián"}</b><small>Sistema de gestión</small></span>
          </div>
          <nav style={{ display: "grid", gap: 2 }}>
            {admin && <button className="btn primary" style={{ marginBottom: 12 }} onClick={panels.newOrder}><Icon n="plus" />Nueva orden</button>}
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end className="nav-btn">
                <Icon n={n.icon} />{n.label}{count(n.to) ? <span className="count">{count(n.to)}</span> : null}
              </NavLink>
            ))}
          </nav>
          <div className="spacer" />
          <div className="side-foot">
            <div className="who">
              <span className="av lg">{initials(user!.name)}</span>
              <span style={{ flex: 1, minWidth: 0 }}><b style={{ display: "block", fontSize: 14 }}>{user!.name}</b><span className="muted" style={{ fontSize: 12 }}>{admin ? "Administrador" : "Mecánico"}</span></span>
              <ThemeSwitch />
            </div>
            <button className="link-btn quiet" style={{ paddingInline: 4 }} onClick={logout}>Cerrar sesión</button>
          </div>
        </aside>
        <main className="main">
          <div className="mobile-brand">
            <span className="logo-chip"><img src="/logo.png" alt="" /></span>
            <b>{settings?.businessName ?? "Taller Mecánico Fabián"}</b>
            <ThemeSwitch />
          </div>
          <Routes>
            <Route path="/" element={<Taller />} />
            <Route path="/ajustes" element={<Ajustes />} />
            {admin && <>
              <Route path="/resumen" element={<Resumen />} />
              <Route path="/historial" element={<Historial />} />
              <Route path="/inventario" element={<Inventario />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/tarifario" element={<Tarifario />} />
            </>}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      <nav className="tabbar" aria-label="Menú" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
        {tabs.map((t) => t === "new" ? (
          <button key="new" className="tab plus" onClick={panels.newOrder}><span className="ic"><Icon n="plus" /></span>Nueva</button>
        ) : t === "more" ? (
          <button key="more" className="tab" aria-current={moreItems.some((m) => m.to === loc.pathname) ? "page" : undefined} onClick={() => setMore(true)}><Icon n="more" />Más</button>
        ) : (
          <button key={t.to} className="tab" aria-current={loc.pathname === t.to ? "page" : undefined} onClick={() => navigate(t.to)}><Icon n={t.icon} />{t.label}</button>
        ))}
      </nav>

      <Modal open={more} onClose={() => setMore(false)} label="Más opciones">
        <ModalHead title="Más" onClose={() => setMore(false)} />
        <div className="card-body">
          <div className="list panel">
            {moreItems.map((n) => (
              <button key={n.to} className="list-row row-click plain" onClick={() => navigate(n.to)}>
                <span style={{ width: 22, height: 22, color: "var(--accent)" }}><Icon n={n.icon} /></span>
                <span className="grow t">{n.label}</span>
                <Icon n="arrow" style={{ width: 16, height: 16, color: "var(--muted)" }} />
              </button>
            ))}
          </div>
          <button className="link-btn quiet" style={{ justifySelf: "start" }} onClick={logout}>Cerrar sesión</button>
        </div>
      </Modal>

      <OrderSheet id={orderId} onClose={closeOrder} />
      <ClientSheet id={clientId} onClose={closeClient} />
      {admin && <NewOrder open={creating} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); navigate("/"); setTimeout(() => setOrderId(id), 160); }} />}
    </PanelsCtx.Provider>
  );
}
