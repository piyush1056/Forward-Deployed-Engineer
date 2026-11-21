import { openai, HARNESS_CONFIG } from "../config/openai.js";
import { withTimeout } from "../utils/withTimeout.js";

/**
 * Validates the generated draft using Deterministic Rules first, then LLM-as-a-Judge.
 * Returns { passed: boolean, isFormatError: boolean, errors: string[] }
 */
export async function evaluateDraft(draft, compactedTickets) {
    const errors = [];
    let isFormatError = false;

    // --- LAYER 1: DETERMINISTIC EVALUATOR ---

    // Check 1: Required Markdown headings must exist
    if (!draft.includes("## New Features") || !draft.includes("## Bug Fixes")) {
        errors.push('Draft must contain both "## New Features" and "## Bug Fixes" headings.');
        isFormatError = true;
    }

    // Check 2: Every Feature and Bug ticket ID MUST appear in the draft
    const publicTickets = compactedTickets.filter((t) => t.type !== "Internal");
    for (const ticket of publicTickets) {
        if (!draft.includes(ticket.id)) {
            errors.push(`Missing required customer-facing ticket ID: ${ticket.id} (${ticket.summary})`);
        }
    }

    // Check 3: Internal ticket IDs must NEVER appear in the draft
    const internalTickets = compactedTickets.filter((t) => t.type === "Internal");
    for (const ticket of internalTickets) {
        if (draft.includes(ticket.id)) {
            errors.push(`Security/Scope leak: Internal ticket ${ticket.id} must NOT be included.`);
        }
    }

    // If deterministic JS checks already failed, no need to move forward
    if (errors.length > 0) {
        console.log(`[Evaluator - Deterministic Failed]`, errors);
        return { passed: false, isFormatError, errors };
    }

    // --- LAYER 2: LLM-AS-A-JUDGE (Checks tone, clarity, and hallucinations) ---
    return withTimeout(
        async (signal) => {
            const judgePrompt = `You are a strict QA reviewer grading release notes against source Jira tickets.
Check for:
1. Hallucinations (claiming features that are not in the source tickets).
2. Unclear jargon that normal customers would not understand.
3. Any mention of internal database/infrastructure upgrades even without the ticket ID.

Respond ONLY in valid JSON with this exact shape:
{ "passed": boolean, "reason": "short explanation if failed, or empty string if passed" }`;

            const response = await openai.chat.completions.create(
                {
                    model: HARNESS_CONFIG.MODEL,
                    temperature: 0, // Deterministic grading
                    response_format: { type: "json_object" }, // Guarantees valid JSON back
                    messages: [
                        { role: "system", content: judgePrompt },
                        {
                            role: "user",
                            content: `SOURCE TICKETS:\n${JSON.stringify(compactedTickets)}\n\nDRAFT TO GRADE:\n${draft}`,
                        },
                    ],
                },
                { signal }
            );

            const verdict = JSON.parse(response.choices[0].message.content);

            if (!verdict.passed) {
                console.log(`[Evaluator - LLM Judge Failed]`, verdict.reason);
                return {
                    passed: false,
                    isFormatError: false,
                    errors: [`LLM Judge Feedback: ${verdict.reason}`],
                };
            }

            console.log(`[Evaluator - PASSED] All deterministic and LLM Judge checks passed!`);
            return { passed: true, isFormatError: false, errors: [] };
        },
        HARNESS_CONFIG.LLM_TIMEOUT_MS,
        "LLM-as-a-Judge Evaluation"
    );
}