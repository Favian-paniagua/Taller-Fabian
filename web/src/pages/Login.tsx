import { useState } from "react";
import { useAuth } from "../lib/auth";
import { ThemeSwitch } from "../lib/theme";

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo ingresar.");
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-top"><ThemeSwitch /></div>
      <form className="login-card panel" onSubmit={submit} noValidate>
        <span className="logo-chip big"><img src="/logo.png" alt="" /></span>
        <div style={{ textAlign: "center" }}>
          <h1>Taller Mecánico Fabián</h1>
          <p className="muted">Ingresa con tu usuario para continuar</p>
        </div>
        <div className="field">
          <label htmlFor="lg-user">Usuario</label>
          <input id="lg-user" autoComplete="username" autoCapitalize="none" autoCorrect="off" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label htmlFor="lg-pass">Contraseña</label>
          <input id="lg-pass" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="btn primary lg" type="submit" disabled={busy || !username || !password}>{busy ? "Ingresando…" : "Ingresar"}</button>
        <p className="muted" style={{ fontSize: 12, textAlign: "center" }}>¿Olvidaste tu contraseña? Pídele al dueño del taller que te asigne una nueva.</p>
      </form>
    </div>
  );
}
