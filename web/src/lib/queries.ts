import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { Mechanic, OrderDetail, OrderSummary, Part, Service, Settings } from "./types";

export const useSettings = () => useQuery({ queryKey: ["settings"], queryFn: () => api.get<Settings>("/settings"), staleTime: 5 * 60e3 });
export const useMechanics = () => useQuery({ queryKey: ["mechanics"], queryFn: () => api.get<Mechanic[]>("/mechanics"), staleTime: 60e3 });
export const useServices = () => useQuery({ queryKey: ["services"], queryFn: () => api.get<Service[]>("/services") });
export const useParts = () => useQuery({ queryKey: ["parts"], queryFn: () => api.get<Part[]>("/parts") });
export const useActiveOrders = () => useQuery({ queryKey: ["orders", "activas"], queryFn: () => api.get<OrderSummary[]>("/orders?scope=activas"), refetchInterval: 30e3 });
export const useOrder = (id: number | null) => useQuery({ queryKey: ["order", id], queryFn: () => api.get<OrderDetail>(`/orders/${id}`), enabled: !!id });

export type CashToday = { day: string; cash: number; qr: number; list: { orderId: number; number: number; method: "efectivo" | "qr"; amount: number; createdAt: number; receiptNumber: number; plate: string; clientName: string }[]; closing: { countedCash: number; expectedCash: number; createdAt: number } | null };
export const useCashToday = (enabled = true) => useQuery({ queryKey: ["cash"], queryFn: () => api.get<CashToday>("/cash/today"), enabled });
