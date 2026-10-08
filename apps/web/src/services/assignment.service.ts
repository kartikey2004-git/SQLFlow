import type { AssignmentSummary, AssignmentDetail } from "@sql-learn/types";

import { getApiBase } from "@/lib/config";

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

const parseEnvelope = async <T,>(response: Response): Promise<ApiEnvelope<T>> => {
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) {
    throw new Error(`API returned ${response.status} ${type || "non-JSON"} (expected JSON)`);
  }
  return response.json();
};

export const fetchAssignments = async (): Promise<AssignmentSummary[]> => {
  const response = await fetch(`${getApiBase()}/assignments`, { credentials: "include" });
  const result = await parseEnvelope<AssignmentSummary[]>(response);
  if (!result.success) {
    throw new Error(result.message || "Failed to fetch assignments");
  }
  return result.data;
};

export const fetchAssignmentById = async (id: number): Promise<AssignmentDetail> => {
  const response = await fetch(`${getApiBase()}/assignments/${id}`, { credentials: "include" });
  const result = await parseEnvelope<AssignmentDetail>(response);
  if (!result.success) {
    throw new Error(result.message || "Failed to fetch assignment");
  }
  return result.data;
};
