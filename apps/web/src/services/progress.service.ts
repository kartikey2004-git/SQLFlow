import type { ProgressData } from "@sql-learn/types";

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
  if (!result.success) {
    throw new Error(result.message || "Request failed");
  }
  return result.data;
};

export const getProgress = (assignmentId: number): Promise<ProgressData> =>
  request(`/progress/${assignmentId}`);

export const updateProgress = (
  assignmentId: number,
  updates: { lastQuery?: string; incrementAttempt?: boolean },
): Promise<ProgressData> =>
  request(`/progress/${assignmentId}`, { method: "PUT", body: JSON.stringify(updates) });

export const getAllProgress = (): Promise<
  Array<{ assignmentId: number; assignmentTitle: string; progress: ProgressData }>
> => request("/progress/all");
