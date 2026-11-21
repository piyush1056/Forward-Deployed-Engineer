import { openai, HARNESS_CONFIG } from "../config/openai.js";
import { withTimeout } from "../utils/withTimeout.js";

/**
 * Generates or refines release notes using OpenAI.
 *
 * @param {string} releaseVersion - e.g. "v2.4.0"
 * @param {Array} compactedTickets - Clean tickets from jiraService
 * @param {string} previousDraft - Empty on attempt 1; contains previous draft on retries
 * @param {Array<string>} validationErrors - Errors from Evaluator (for Model Context Retry)
 * @param {boolean} isFormatRetry - True if last attempt broke formatting rules (Instruction Retry)
 */
export async function generateReleaseNotesDraft({
    releaseVersion,
    compactedTickets,
    previousDraft = "",
    validationErrors = [],
    isFormatRetry = false,
}) {

    let systemPrompt = `You are a technical product writer generating customer-facing release notes for version ${releaseVersion}.
Rules:
1. Include ONLY "Feature" and "Bug" tickets.
2. NEVER include "Internal" tickets.
3. Always mention the exact ticket ID in parentheses, e.g., (PAY-101).
4. Use clean Markdown with ONLY two headings: "## New Features" and "## Bug Fixes".
5. Do not add conversational filler like "Here are the release notes".`;

    // INSTRUCTION RETRY: If the LLM broke formatting rules last time, add stricter rules
    if (isFormatRetry) {
        systemPrompt += `\n\nCRITICAL FORMAT WARNING: Your previous response violated formatting rules. Output ONLY raw Markdown starting directly with "## New Features". No intro or outro text.`;
    }

    // Build the user message (Model Context)
    let userPrompt = `Here are the compacted Jira tickets for ${releaseVersion}:\n${JSON.stringify(compactedTickets, null, 2)}`;

    // MODEL CONTEXT RETRY: If Evaluator found missing tickets or leaked internal tasks,
    // feed the previous draft + exact errors back into the context so the LLM fixes them.
    if (previousDraft && validationErrors.length > 0) {
        userPrompt += `\n\n--- PREVIOUS DRAFT (REJECTED) ---\n${previousDraft}`;
        userPrompt += `\n\n--- ERRORS TO FIX ---\n${validationErrors.map((err, i) => `${i + 1}. ${err}`).join("\n")}`;
        userPrompt += `\n\nRewrite the release notes fixing ALL listed errors while keeping everything else accurate.`;
    }

    // Wrap OpenAI call in withTimeout
    return withTimeout(
        async (signal) => {
            const response = await openai.chat.completions.create(
                {
                    model: HARNESS_CONFIG.MODEL,
                    temperature: 0.2,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt },
                    ],
                },
                { signal } // Connects our AbortController directly to the OpenAI SDK request
            );

            return response.choices[0].message.content.trim();
        },
        HARNESS_CONFIG.LLM_TIMEOUT_MS,
        "OpenAI Draft Generation"
    );
}