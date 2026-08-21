import type { AssignmentSummary, AssignmentDetail } from "@sql-learn/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export const fetchAssignments = async (): Promise<AssignmentSummary[]> => {
  const response = await fetch(`${API_URL}/assignments`, { credentials: "include" });
  const result: ApiEnvelope<AssignmentSummary[]> = await response.json();
  if (!result.success) {
    throw new Error(result.message || "Failed to fetch assignments");
  }
  return result.data;
};

export const fetchAssignmentById = async (id: number): Promise<AssignmentDetail> => {
  const response = await fetch(`${API_URL}/assignments/${id}`, { credentials: "include" });
  const result: ApiEnvelope<AssignmentDetail> = await response.json();
  if (!result.success) {
    throw new Error(result.message || "Failed to fetch assignment");
  }
  return result.data;
};
