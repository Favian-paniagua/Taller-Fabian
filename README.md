# Taller Mecánico Fabián

Sistema de gestión a medida para el Taller Mecánico Fabián (mecánica general, electricidad y motos). Funciona en la PC del taller y los mecánicos entran desde su celular por el WiFi.

**Para instalarlo en la PC del taller, sigue la [guía de instalación](docs/instalacion.md).**

## Qué hace

- **Taller:** tablero con los vehículos en el taller en 4 pasos de color: Revisión, Presupuesto, Reparación y Entrega.
- **Órdenes de trabajo:**
  - Recepción en 2 pasos: kilometraje, combustible, objetos dejados y mecánico.
  - Trabajos del tarifario y repuestos del stock.
  - Presupuesto y aviso de "listo" por WhatsApp.
  - Cobro en efectivo o QR, con nota de venta para imprimir o enviar.
- **Resumen:**
  - Ingresos, vehículos, ticket promedio y tiempo en el taller por semana, mes o 3 meses.
  - Comparación con el periodo anterior.
  - Gráficos por tipo de trabajo y por día de la semana.
  - Clientes para recordar y caja del día.
- **Inventario:**
  - Repuestos con colores por categoría y estado del stock.
  - Ingresos de mercadería, corrección por conteo e historial de movimientos.
- **Historial, Clientes y Tarifario.**
- **Usuarios:**
  - El dueño ve todo.
  - Cada mecánico ve solo sus trabajos, sin precios ni caja.
  - Inicio de sesión con contraseña.
- **Copias de seguridad:** una automática por día, más copias a pedido.
- **Pantalla:** modo claro y oscuro, en computadora y celular.

## Cómo está hecho

| Parte | Tecnología |
| --- | --- |
| Servidor | Node.js 20+, Express, TypeScript |
| Base de datos | SQLite (un solo archivo: `server/data/taller.db`) con Drizzle ORM |
| Pantallas | React 18, Vite, TanStack Query |
| Seguridad | Contraseñas con bcrypt, sesión en cookie httpOnly, permisos por rol en el servidor, límite de intentos de ingreso |

Los montos se guardan en centavos para no perder precisión.

```
server/   API, base de datos, migraciones (server/drizzle) y pruebas (server/test)
web/      Pantallas en React
scripts/  instalar.bat, iniciar.bat y actualizar.bat para Windows
docs/     Guía de instalación
demo/     Demo aprobada por el cliente (primera versión de prueba)
```

## Para desarrollar

```bash
npm install
npm run datos-demo      # opcional: carga datos de ejemplo en una base vacía
npm run dev             # servidor en :3000 y pantallas en :5173 con recarga automática
npm test                # pruebas de la API
npm run build && npm start   # versión final en http://localhost:3000
```

Si se cambia `server/src/db/schema.ts`, hay que generar la migración con `npm run db:generate -w server`. Se aplica sola al encender.

### Variables opcionales (`server/.env`)

| Variable | Para qué | Valor por defecto |
| --- | --- | --- |
| `PORT` | Puerto del sistema | `3000` |
| `DATA_DIR` | Carpeta de la base de datos | `server/data` |
| `BACKUP_EXTRA_DIR` | Segunda copia diaria (USB o Google Drive) | sin usar |
| `BACKUP_KEEP` | Cuántas copias conservar | `30` |
| `ADMIN_PASSWORD` | Contraseña inicial del dueño (si no, se genera una) | aleatoria |
