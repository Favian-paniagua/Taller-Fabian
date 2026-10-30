// Aplica el tema guardado antes de pintar, para que la pantalla no parpadee
try { var m = localStorage.getItem("taller-modo"); if (m === "light" || m === "dark") document.documentElement.setAttribute("data-mode", m); } catch (e) {}
