/** Datos de partida del taller. Los precios están en bolivianos; se guardan en centavos. */

export const DEFAULT_SETTINGS: Record<string, string> = {
  businessName: "Taller Mecánico Fabián",
  tagline: "Mecánica general · Electricidad · Motos",
  phone: "",
  address: "",
  receiptNote: "Documento sin valor fiscal. Gracias por su confianza.",
};

/** Tarifario de mano de obra. Solo el cambio de aceite (Bs 100) es un precio confirmado; el resto es aproximado. */
export const SERVICES: [string, string, number][] = [
  ["Cambio de aceite (mano de obra)", "Mecánica", 100],
  ["Afinado de motor", "Mecánica", 250],
  ["Cambio de pastillas de freno (por eje)", "Mecánica", 120],
  ["Cambio de kit de embrague", "Mecánica", 450],
  ["Cambio de correa de distribución", "Mecánica", 380],
  ["Limpieza de inyectores", "Mecánica", 180],
  ["Revisión de suspensión delantera", "Mecánica", 150],
  ["Diagnóstico con escáner", "Electricidad", 80],
  ["Revisión del sistema eléctrico", "Electricidad", 100],
  ["Reparación de alternador", "Electricidad", 200],
  ["Reparación de motor de arranque", "Electricidad", 180],
  ["Cambio e instalación de batería", "Electricidad", 30],
  ["Mantenimiento general de moto", "Motos", 120],
  ["Cambio de kit de arrastre", "Motos", 70],
  ["Afinado de moto", "Motos", 90],
];

export const SERVICE_CATEGORIES = ["Mecánica", "Electricidad", "Motos"];

/** Catálogo de repuestos comunes: código, nombre, categoría, costo, precio, mínimo, ubicación. */
export const PARTS: [string, string, string, number, number, number, string][] = [
  ["LUB-001", "Aceite 20W-50 mineral (galón)", "Lubricantes", 120, 160, 4, "A1"],
  ["LUB-002", "Aceite 10W-40 semisintético (galón)", "Lubricantes", 165, 220, 4, "A1"],
  ["LUB-003", "Aceite 5W-30 sintético (litro)", "Lubricantes", 55, 75, 6, "A1"],
  ["LUB-004", "Aceite moto 4T 20W-50 (litro)", "Lubricantes", 30, 45, 6, "A2"],
  ["LUB-005", "Líquido de frenos DOT 4 (500 ml)", "Lubricantes", 28, 40, 3, "A2"],
  ["LUB-006", "Refrigerante (galón)", "Lubricantes", 45, 65, 3, "A2"],
  ["LUB-007", "Grasa multipropósito (500 g)", "Lubricantes", 25, 38, 2, "A2"],
  ["FIL-101", "Filtro de aceite Toyota 90915", "Filtros", 22, 35, 6, "B1"],
  ["FIL-102", "Filtro de aceite Suzuki / Nissan", "Filtros", 20, 32, 5, "B1"],
  ["FIL-103", "Filtro de aire Corolla", "Filtros", 38, 60, 3, "B1"],
  ["FIL-104", "Filtro de aire Hilux", "Filtros", 55, 85, 2, "B1"],
  ["FIL-105", "Filtro de combustible universal", "Filtros", 25, 40, 4, "B1"],
  ["FIL-106", "Filtro de aceite moto", "Filtros", 12, 20, 5, "B2"],
  ["ENC-201", "Bujía NGK estándar", "Encendido", 15, 25, 16, "B3"],
  ["ENC-202", "Bujía NGK iridium", "Encendido", 55, 85, 8, "B3"],
  ["ENC-203", "Bujía moto NGK C7HSA", "Encendido", 10, 18, 10, "B3"],
  ["ENC-204", "Cables de bujía Toyota (juego)", "Encendido", 110, 160, 2, "B3"],
  ["FRE-301", "Pastillas delanteras Toyota Corolla", "Frenos", 120, 180, 2, "C1"],
  ["FRE-302", "Pastillas delanteras Hilux", "Frenos", 170, 250, 2, "C1"],
  ["FRE-303", "Pastillas delanteras Hyundai / Kia", "Frenos", 110, 165, 2, "C1"],
  ["FRE-304", "Zapatas traseras Toyota", "Frenos", 95, 140, 2, "C1"],
  ["FRE-305", "Pastillas de freno moto", "Frenos", 35, 60, 3, "C2"],
  ["TRA-401", "Kit de embrague Corolla 1.8", "Transmisión", 520, 720, 1, "C3"],
  ["TRA-402", "Kit de arrastre Honda CG 150", "Transmisión", 190, 280, 2, "C3"],
  ["TRA-403", "Kit de arrastre Yamaha YBR 125", "Transmisión", 180, 265, 2, "C3"],
  ["TRA-404", "Correa de distribución Toyota 1ZZ", "Transmisión", 140, 210, 1, "C3"],
  ["ELE-501", "Batería 12V 13 placas", "Eléctrico", 520, 690, 2, "D1"],
  ["ELE-502", "Batería moto 12V 7Ah", "Eléctrico", 140, 210, 2, "D1"],
  ["ELE-503", "Foco H4 halógeno", "Eléctrico", 15, 25, 8, "D2"],
  ["ELE-504", "Foco de freno 1157", "Eléctrico", 4, 8, 10, "D2"],
  ["ELE-505", "Fusibles surtidos (caja)", "Eléctrico", 18, 30, 3, "D2"],
  ["ELE-506", "Relé 12V 4 pines", "Eléctrico", 18, 30, 4, "D2"],
  ["ELE-507", "Escobillas de alternador", "Eléctrico", 30, 45, 3, "D2"],
  ["ELE-508", "Bendix motor de arranque Toyota", "Eléctrico", 90, 135, 2, "D2"],
  ["ELE-509", "Regulador de voltaje", "Eléctrico", 85, 130, 2, "D2"],
  ["SUS-601", "Amortiguador delantero Corolla", "Suspensión", 260, 380, 2, "E1"],
  ["SUS-602", "Rótula inferior Toyota", "Suspensión", 75, 115, 2, "E1"],
  ["SUS-603", "Terminal de dirección", "Suspensión", 60, 95, 2, "E1"],
  ["VAR-701", "Limpiador de inyectores (aerosol)", "Varios", 35, 55, 3, "E2"],
  ["VAR-702", "Abrazaderas surtidas (bolsa)", "Varios", 12, 20, 4, "E2"],
];

export const PART_CATEGORIES = ["Lubricantes", "Filtros", "Encendido", "Frenos", "Transmisión", "Eléctrico", "Suspensión", "Varios"];
