const nf = new Intl.NumberFormat("es-BO", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("es-BO", { maximumFractionDigits: 2 });
export const nf1 = new Intl.NumberFormat("es-BO", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

/** Centavos → "Bs 1.250" (con decimales solo si los hay). */
export const money = (cents: number | undefined | null) => {
  const v = (cents ?? 0) / 100;
  return "Bs " + (Number.isInteger(v) ? nf.format(v) : nf2.format(v));
};
export const toBs = (cents: number) => cents / 100;
export const num = (n: number) => nf.format(n);

export const plateTxt = (p: string) => (p.length > 3 ? `${p.slice(0, -3)} ${p.slice(-3)}` : p);
export const otNum = (n: number) => `OT-${String(n).padStart(4, "0")}`;
export const firstName = (name: string) => name.split(" ")[0];
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const timeHM = (t: number) => new Date(t).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", hour12: false });
export const dateShort = (t: number) => new Date(t).toLocaleDateString("es-BO", { day: "numeric", month: "short" }).replace(".", "");
export const dayLong = (t: number) => `${new Date(t).toLocaleDateString("es-BO", { weekday: "short" }).replace(".", "")} ${dateShort(t)}`;
export const sameDay = (a: number, b = Date.now()) => new Date(a).toDateString() === new Date(b).toDateString();
export const when = (t: number) => (sameDay(t) ? timeHM(t) : `${dateShort(t)} ${timeHM(t)}`);

export function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "recién";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "ayer" : `hace ${d} días`;
}

export const waLink = (phone: string | undefined, text: string) => `https://wa.me/591${(phone ?? "").replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
export const FUEL = ["Reserva", "1/4", "1/2", "3/4", "Lleno"];
export const OBJECTS = ["Radio", "Gata", "Llanta de auxilio", "Herramientas", "Documentos", "Casco", "Triángulos"];
export const initials = (name: string) => name.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
/** Clase de color del avatar: alterna entre dos tonos según el id. */
export const avClass = (id: number | undefined) => (id && id % 2 === 0 ? "m2" : "");
