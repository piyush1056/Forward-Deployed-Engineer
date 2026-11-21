import { HARNESS_CONFIG } from "../config/openai.js";
import { createTask, saveCheckpoint, getCheckpoint } from "../store/taskStore.js";
import { fetchAndCompactJiraTickets, publishReleaseNotes } from "./jiraService.js";
import { generateReleaseNotesDraft } from "./llmService.js";
import { evaluateDraft } from "./evaluatorService.js";

/**
 * Runs (or resumes) the Agent Harness workflow until it either:
 * 1. Passes validation and pauses at "AWAITING_APPROVAL" (Human-in-the-Loop), OR
 * 2. Hits MAX_ATTEMPTS / TASK_TIMEOUT_MS and marks the task "FAILED".
 */
export async function runReleaseNotesHarness(taskId, releaseVersion) {
    const taskStartTime = Date.now();

    // FAULT TOLERANCE: Load existing checkpoint if resuming after a crash; otherwise create new task
    let state = getCheckpoint(taskId) || createTask(taskId, releaseVersion);

    try {
        // STEP 1: Fetch & compact tickets ONLY if we haven't done it in an earlier checkpoint
        if (state.status === "CREATED") {
            const compactedTickets = await fetchAndCompactJiraTickets(releaseVersion);
            state = saveCheckpoint(taskId, {
                status: "TICKETS_FETCHED",
                compactedTickets,
            });
        }

        // STEP 2: THE AGENT LOOP (Plan -> Act -> Observe -> Decide)
        let isFormatRetry = false;

        while (state.attemptCount < HARNESS_CONFIG.MAX_ATTEMPTS) {
            // Overall Task Timeout Guard: Kill loop if total time exceeds 2 minutes
            if (Date.now() - taskStartTime > HARNESS_CONFIG.TASK_TIMEOUT_MS) {
                throw new Error(`Overall task timeout exceeded (${HARNESS_CONFIG.TASK_TIMEOUT_MS}ms)`);
            }

            const nextAttempt = state.attemptCount + 1;
            console.log(`\n--- [Agent Loop] Starting Attempt ${nextAttempt}/${HARNESS_CONFIG.MAX_ATTEMPTS} ---`);

            // PLAN & ACT: Generate or refine the release notes draft using OpenAI
            const draft = await generateReleaseNotesDraft({
                releaseVersion: state.releaseVersion,
                compactedTickets: state.compactedTickets,
                previousDraft: state.currentDraft,
                validationErrors: state.validationErrors,
                isFormatRetry,
            });

            // Save checkpoint right after generation (if server crashes during evaluation, draft is safe)
            state = saveCheckpoint(taskId, {
                status: "DRAFTING",
                attemptCount: nextAttempt,
                currentDraft: draft,
            });

            // OBSERVE: Run Evaluator (Deterministic JS + LLM-as-a-Judge)
            const evalResult = await evaluateDraft(draft, state.compactedTickets);

            // DECIDE: If Evaluator says PASS, pause for Human-in-the-Loop approval!
            if (evalResult.passed) {
                state = saveCheckpoint(taskId, {
                    status: "AWAITING_APPROVAL",
                    validationErrors: [],
                });
                return state; // Exit loop and wait for human API call
            }

            // If Evaluator FAILED: record errors so next loop iteration uses Instruction or Context Retry
            isFormatRetry = evalResult.isFormatError;
            state = saveCheckpoint(taskId, {
                validationErrors: evalResult.errors,
            });
        }

        // If loop finishes all 3 attempts without passing, fail safely
        throw new Error(`Agent failed validation after ${HARNESS_CONFIG.MAX_ATTEMPTS} attempts.`);
    } catch (error) {
        console.error(`[Harness Error] Task ${taskId}:`, error.message);
        return saveCheckpoint(taskId, {
            status: "FAILED",
            validationErrors: [...state.validationErrors, error.message],
        });
    }
}

/**
 * Human-in-the-Loop (HITL) Resume Function:
 * Called when a human reviews the draft (and optionally edits it) and clicks Approve.
 */
export async function approveAndPublishTask(taskId, editedDraft = null) {
    const state = getCheckpoint(taskId);

    if (!state) {
        throw new Error(`Task ${taskId} not found.`);
    }
    if (state.status !== "AWAITING_APPROVAL") {
        throw new Error(`Cannot approve task in status "${state.status}". Must be AWAITING_APPROVAL.`);
    }

    // Use human-edited text if provided, otherwise use the AI's validated draft
    const finalDraft = editedDraft || state.currentDraft;

    // Execute the final external action
    await publishReleaseNotes(state.releaseVersion, finalDraft);

    // Save final completed checkpoint
    return saveCheckpoint(taskId, {
        status: "PUBLISHED",
        currentDraft: finalDraft,
    });
}