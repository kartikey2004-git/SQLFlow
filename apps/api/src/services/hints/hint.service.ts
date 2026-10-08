import { AssignmentRepository } from "../../repositories/assignment.repository";
import { HintRequestRepository } from "../../repositories/hintRequest.repository";
import { HintProvider } from "../ai/hint.provider";
import { LeakDetectionService } from "./leakDetection.service";
import { ApiError } from "../../utils/ApiError";

const MAX_HINTS_PER_ASSIGNMENT = 4;
const MAX_HINTS_PER_HOUR = 10;
const MAX_REGENERATION_ATTEMPTS = 2;
const FALLBACK_HINT_TEXT =
  "Focus on which SQL clause matches what the question is asking for, and double-check your table and column names against the schema shown above.";

export interface HintResult {
  hintLevel: number;
  hintText: string;
  conceptTag: string | null;
  requestsRemaining: number;
}

export class HintService {
  static async getHint(
    userId: number,
    assignmentId: number,
    userQuery: string,
    attemptId: number | null,
  ): Promise<HintResult> {
    if (!HintProvider.isConfigured()) {
      throw new ApiError(501, "AI hints are not configured on this server");
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await HintRequestRepository.countSince(userId, oneHourAgo);
    if (recentCount >= MAX_HINTS_PER_HOUR) {
      throw new ApiError(429, "Hint rate limit exceeded - try again later");
    }

    const assignmentHintCount = await HintRequestRepository.countForAssignment(userId, assignmentId);
    if (assignmentHintCount >= MAX_HINTS_PER_ASSIGNMENT) {
      throw new ApiError(429, `Maximum of ${MAX_HINTS_PER_ASSIGNMENT} hints per assignment reached`);
    }

    const assignment = await AssignmentRepository.findInternalById(assignmentId);
    if (!assignment) {
      throw new ApiError(404, "Assignment not found");
    }

    const hintLevel = Math.min(assignmentHintCount + 1, 4) as 1 | 2 | 3 | 4;
    const requestsRemaining = MAX_HINTS_PER_ASSIGNMENT - (assignmentHintCount + 1);
    const priorHints = await HintRequestRepository.findHistory(userId, assignmentId);

    for (let attempt = 0; attempt <= MAX_REGENERATION_ATTEMPTS; attempt++) {
      const generated = await HintProvider.generate({
        assignmentQuestion: assignment.question,
        sampleTables: assignment.sample_tables,
        studentQuery: userQuery,
        hintLevel,
        priorHints: priorHints.map((h) => ({ hintLevel: h.hint_level, hintText: h.hint_text })),
      });

      const leakResult = LeakDetectionService.check(generated.hintText, assignment.solution_sql);
      if (!leakResult.leaked) {
        await HintRequestRepository.create({
          userId,
          assignmentId,
          attemptId,
          userQuery,
          hintLevel,
          conceptTag: generated.conceptTag,
          hintText: generated.hintText,
          model: generated.model,
          inputTokens: generated.inputTokens,
          outputTokens: generated.outputTokens,
          leakCheckPassed: true,
        });
        return { hintLevel, hintText: generated.hintText, conceptTag: generated.conceptTag, requestsRemaining };
      }

      console.warn(`Hint leak-check rejected attempt ${attempt + 1}/${MAX_REGENERATION_ATTEMPTS + 1}: ${leakResult.reason}`);
    }

    await HintRequestRepository.create({
      userId,
      assignmentId,
      attemptId,
      userQuery,
      hintLevel,
      conceptTag: null,
      hintText: FALLBACK_HINT_TEXT,
      leakCheckPassed: false,
    });
    return { hintLevel, hintText: FALLBACK_HINT_TEXT, conceptTag: null, requestsRemaining };
  }

  static async getHintHistory(userId: number, assignmentId?: number) {
    const history = await HintRequestRepository.findHistory(userId, assignmentId);
    return history.map((h) => ({
      hintLevel: h.hint_level,
      hintText: h.hint_text,
      conceptTag: h.concept_tag,
      createdAt: h.created_at,
    }));
  }
}
