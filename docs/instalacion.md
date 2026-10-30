# Instalación en la PC del taller

Esta guía es para dejar el sistema funcionando en la computadora del taller y que los mecánicos entren desde su celular por el WiFi. Se hace una sola vez y toma unos 20 minutos.

## Lo que hace falta

- Una PC con Windows 10 u 11 que quede encendida mientras el taller trabaja.
- Internet solo para la instalación y las actualizaciones. Después, el sistema funciona sin internet dentro del taller.
- El router WiFi del taller, con la PC y los celulares conectados a la misma red.

## 1. Instalar los programas necesarios

1. Instala **Node.js** desde https://nodejs.org (botón "LTS"). Acepta las opciones que vienen marcadas.
2. Instala **Git** desde https://git-scm.com/download/win. Acepta las opciones que vienen marcadas.

## 2. Descargar el sistema

1. Abre la carpeta donde quieras guardar el sistema, por ejemplo `C:\Taller`.
2. Haz clic derecho dentro de la carpeta y elige **Abrir en Terminal** (o "Git Bash Here").
3. Escribe este comando y presiona Enter:

   ```
   git clone https://github.com/Favian-paniagua/Taller-Fabian.git sistema
   ```

## 3. Instalar y encender

1. Entra a `C:\Taller\sistema\scripts` y abre **instalar.bat**. Espera a que diga "Listo".
2. Abre **iniciar.bat**. Se abre una ventana negra y, a los pocos segundos, el navegador con la pantalla de ingreso.
3. La primera vez, la ventana negra muestra el **usuario y la contraseña del dueño**. También quedan guardados en `server\data\primer-ingreso.txt`. Entra con ellos y cámbiala en **Ajustes > Mi cuenta**.

> La ventana negra es el sistema funcionando. Se puede minimizar, pero no cerrar.

### Que se encienda solo con la PC

1. Presiona `Windows + R`, escribe `shell:startup` y presiona Enter.
2. En la carpeta que se abre, crea un acceso directo a `C:\Taller\sistema\scripts\iniciar.bat`.

## 4. Agregar a los mecánicos

En **Ajustes > Mecánicos > Agregar mecánico**, crea un usuario para cada uno con una contraseña inicial y dísela. Cada mecánico ve solo sus trabajos, sin precios ni caja.

## 5. Entrar desde los celulares

1. Al encender, la ventana negra muestra una línea como esta:

   ```
   Desde el celular:    http://192.168.1.50:3000
   ```

2. En el celular, conectado al WiFi del taller, abre esa dirección en Chrome.
3. Guárdala en la pantalla de inicio: menú de Chrome > **Agregar a la pantalla principal**. Queda como una aplicación con el logo del taller.

**Si el celular no abre la página:**

- **Firewall de Windows.** La primera vez que se enciende el sistema, Windows pregunta si permite el acceso a "Node.js". Marca **Redes privadas** y acepta. Si no lo preguntó, busca "Firewall de Windows Defender" > "Permitir una aplicación" y habilita Node.js en redes privadas.
- **Dirección fija.** Para que la dirección no cambie, pide en la configuración del router una "IP fija" o "reserva DHCP" para la PC del taller. Si cambia, la nueva aparece en la ventana negra.

## Copias de seguridad

- El sistema guarda **una copia automática por día** en `server\data\copias` y conserva las últimas 30.
- En **Ajustes > Copias de seguridad** se puede hacer una copia en el momento o descargar cualquiera.
- **Recomendado:** guardar una segunda copia fuera de la PC, por si la PC se daña. Crea un archivo `.env` dentro de `C:\Taller\sistema\server` con esta línea, apuntando a una memoria USB o a la carpeta de Google Drive:

  ```
  BACKUP_EXTRA_DIR=G:\Mi unidad\Copias taller
  ```

  El sistema lee ese archivo al encender. Reinícialo (cierra la ventana negra y abre **iniciar.bat**) para que tome el cambio.

**Para restaurar una copia:** cierra el sistema, reemplaza `server\data\taller.db` por la copia (renombrándola a `taller.db`) y vuelve a encenderlo.

## Actualizar a una versión nueva

Cierra la ventana del sistema y abre **scripts\actualizar.bat**. Antes de actualizar guarda una copia de la base, y al terminar abre de nuevo **iniciar.bat**.

## Si se olvida la contraseña del dueño

En la carpeta del sistema, abre una terminal y escribe:

```
npm run cambiar-clave -- fabian NuevaClave123
```

## Probar con datos de ejemplo

Para mostrar el sistema sin datos reales, en una instalación **vacía** se puede cargar el ejemplo de la demo (clientes, vehículos y 6 meses de trabajos):

```
npm run datos-demo
```

Solo funciona si todavía no hay órdenes, para no mezclar datos inventados con los reales. Los mecánicos de prueba son `jhonny` y `marco`, con contraseña `taller123`.
