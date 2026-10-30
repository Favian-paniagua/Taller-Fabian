import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, setUnauthorizedHandler } from "./api";
import type { User } from "./types";

type AuthState = { user: User | null; loading: boolean; login: (u: string, p: string) => Promise<void>; logout: () => Promise<void> };
const Ctx = createContext<AuthState>(null!);
export const useAuth = () => useContext(Ctx);
export const useIsAdmin = () => useContext(Ctx).user?.role === "admin";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  useEffect(() => {
    api.get<{ user: User }>("/auth/me").then((r) => setUser(r.user)).catch(() => setUser(null)).finally(() => setLoading(false));
    setUnauthorizedHandler(() => { setUser(null); qc.clear(); });
  }, [qc]);

  const login = useCallback(async (username: string, password: string) => {
    const r = await api.post<{ user: User }>("/auth/login", { username, password });
    qc.clear();
    setUser(r.user);
  }, [qc]);

  const logout = useCallback(async () => {
    await api.post("/auth/logout").catch(() => {});
    qc.clear();
    setUser(null);
  }, [qc]);

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}
