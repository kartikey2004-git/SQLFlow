import { AttemptRepository, type AttemptUpdate } from "../../repositories/attempt.repository";

export interface ProgressData {
  lastQuery: string;
  attemptCount: number;
  isCompleted: boolean;
  completedAt: Date | null;
  lastAttemptAt: Date;
}

const toProgressData = (attempt: {
  last_query: string;
  attempt_count: number;
  status: string;
  completed_at: Date | null;
  last_attempt_at: Date;
}): ProgressData => ({
  lastQuery: attempt.last_query,
  attemptCount: attempt.attempt_count,
  isCompleted: attempt.status === "completed",
  completedAt: attempt.completed_at,
  lastAttemptAt: attempt.last_attempt_at,
});

export class ProgressService {
  static async getOrCreateProgress(userId: number, assignmentId: number): Promise<ProgressData> {
    const attempt = await AttemptRepository.getOrCreate(userId, assignmentId);
    return toProgressData(attempt);
  }

  static async updateProgress(
    userId: number,
    assignmentId: number,
    updates: Omit<AttemptUpdate, "markCompleted">,
  ): Promise<ProgressData> {
    const { lastQuery, incrementAttempt } = updates;
    const attempt = await AttemptRepository.update(userId, assignmentId, { lastQuery, incrementAttempt });
    return toProgressData(attempt);
  }

  static async markCompletedFromGrading(userId: number, assignmentId: number): Promise<ProgressData> {
    const attempt = await AttemptRepository.update(userId, assignmentId, { markCompleted: true });
    return toProgressData(attempt);
  }

  static async getAllProgress(
    userId: number,
  ): Promise<Array<{ assignmentId: number; assignmentTitle: string; progress: ProgressData }>> {
    const attempts = await AttemptRepository.findAllForUser(userId);
    return attempts.map((attempt) => ({
      assignmentId: attempt.assignment_id,
      assignmentTitle: attempt.assignment_title,
      progress: toProgressData(attempt),
    }));
  }

  static async deleteProgress(userId: number, assignmentId: number): Promise<void> {
    await AttemptRepository.deleteForUser(userId, assignmentId);
  }
}
