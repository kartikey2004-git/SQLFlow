import { AssignmentRepository } from "../../repositories/assignment.repository";
import { TestCaseRepository } from "../../repositories/testCase.repository";
import { ApiError } from "../../utils/ApiError";
import type { AssignmentSummary, AssignmentDetail } from "@sql-learn/types";

export class AssignmentService {
  async getAllAssignments(): Promise<AssignmentSummary[]> {
    const rows = await AssignmentRepository.listPublished();
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      difficulty: row.difficulty,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async getAssignmentById(id: number): Promise<AssignmentDetail> {
    const assignment = await AssignmentRepository.findPublicById(id);
    if (!assignment) {
      throw new ApiError(404, "Assignment not found");
    }

    const testCases = await TestCaseRepository.findByAssignmentId(id);

    return {
      id: assignment.id,
      title: assignment.title,
      description: assignment.description,
      difficulty: assignment.difficulty,
      createdAt: assignment.created_at.toISOString(),
      question: assignment.question,
      sampleTables: assignment.sample_tables,
      testCases: testCases.map((tc) => ({
        id: tc.id,
        name: tc.name,
        isHidden: tc.is_hidden,
        ...(tc.is_hidden
          ? {}
          : {
              expectedOutput: {
                type: tc.expected_output_type,
                value: tc.expected_output,
              },
            }),
      })),
    };
  }
}

export const assignmentService = new AssignmentService();
