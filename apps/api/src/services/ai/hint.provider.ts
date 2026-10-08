import { google } from "@ai-sdk/google";
import { generateText, generateObject } from "ai";
import { z } from "zod";
import type { SampleTableRow } from "../../repositories/assignment.repository";

export interface HintGenerationInput {
  assignmentQuestion: string;
  sampleTables: SampleTableRow[];
  studentQuery: string;
  hintLevel: 1 | 2 | 3 | 4;
  priorHints: { hintLevel: number; hintText: string }[];
}

export interface HintGenerationOutput {
  hintText: string;
  conceptTag: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

const MODEL_ID = "gemini-3.7-flash";

const HintSchema = z.object({
  hintText: z
    .string()
    .describe("1-3 sentence hint. Never a runnable SQL query or fragment."),
  conceptTag: z
    .string()
    .describe(
      "Short snake_case tag for the SQL concept this hint targets, e.g. 'group_by', 'join_condition', 'aggregate_function'.",
    ),
});

const SYSTEM_PROMPT = `<role>
You are a Socratic SQL tutor helping a student practicing SQL queries against a small practice database. Your job is to nudge them toward the fix, never to hand them the answer.
</role>
<constraints>
- Never output a runnable SQL query or a copy-pasteable SQL fragment (no SELECT/FROM/WHERE/JOIN clauses written out).
- Never introduce table or column names beyond what's already given to you in the schema.
- Match the escalation level you're given: level 1 is a conceptual nudge toward the right SQL feature; level 2 names the relevant clause/concept without describing how to use it here; level 3 is specific about what's likely wrong with the current query; level 4 is the most direct guidance you're allowed to give, while still leaving the student to write the SQL themselves.
- Keep the hint to 1-3 sentences.
</constraints>`;

const buildPromptContext = (input: HintGenerationInput): string => {
  const schemaDescription = input.sampleTables
    .map((t) => `${t.tableName}(${t.columns.map((c) => `${c.columnName} ${c.dataType}`).join(", ")})`)
    .join("\n");

  const historyDescription =
    input.priorHints.length > 0
      ? input.priorHints.map((h) => `Level ${h.hintLevel}: ${h.hintText}`).join("\n")
      : "None yet.";

  return `<assignment>
${input.assignmentQuestion}
</assignment>
<schema>
${schemaDescription}
</schema>
<student_query>
${input.studentQuery.trim() || "(empty)"}
</student_query>
<hint_history>
${historyDescription}
</hint_history>
<requested_hint_level>${input.hintLevel}</requested_hint_level>`;
};

export const HintProvider = {
  isConfigured(): boolean {
    return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
  },

  async generate(input: HintGenerationInput): Promise<HintGenerationOutput> {
    if (!this.isConfigured()) {
      throw new Error("AI hint engine is not configured (GOOGLE_GENERATIVE_AI_API_KEY unset)");
    }

    const promptContext = buildPromptContext(input);

    const research = await generateText({
      model: google(MODEL_ID),
      tools: { google_search: google.tools.googleSearch({}) },
      maxOutputTokens: 500,
      system:
        "You are researching SQL concepts to help write a short tutoring hint for a student. Search the web only if it would sharpen or verify your understanding of the relevant SQL feature - otherwise reason directly. Respond with brief working notes, not a final hint.",
      prompt: promptContext,
    });

    const { object, usage } = await generateObject({
      model: google(MODEL_ID),
      schema: HintSchema,
      maxOutputTokens: 300,
      system: SYSTEM_PROMPT,
      prompt: `${promptContext}
<research_notes>
${research.text || "(no additional research needed)"}
</research_notes>`,
    });

    return {
      hintText: object.hintText,
      conceptTag: object.conceptTag ?? null,
      model: MODEL_ID,
      inputTokens: (research.usage.inputTokens ?? 0) + (usage.inputTokens ?? 0),
      outputTokens: (research.usage.outputTokens ?? 0) + (usage.outputTokens ?? 0),
    };
  },
};
