import type { HintResponse } from "@sql-learn/types";

import { API_URL } from "@/lib/config";

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const result: ApiEnvelope<T> = await response.json();
  if (response.status === 501) {
    throw new HintNotConfiguredError(result.message || "AI hints are not configured on this server");
  }
  if (!result.success) {
    throw new Error(result.message || "Request failed");
  }
  return result.data;
};

export class HintNotConfiguredError extends Error {}

export const getHint = (assignmentId: number, userQuery: string): Promise<HintResponse> =>
  request("/hints", { method: "POST", body: JSON.stringify({ assignmentId, userQuery }) });

export interface HintHistoryEntry {
  hintLevel: number;
  hintText: string;
  conceptTag: string | null;
  createdAt: string;
}

export const getHintHistory = (assignmentId?: number): Promise<HintHistoryEntry[]> =>
  request(assignmentId ? `/hints/history?assignmentId=${assignmentId}` : "/hints/history");
