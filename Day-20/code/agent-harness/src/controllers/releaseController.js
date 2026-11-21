import { runReleaseNotesHarness, approveAndPublishTask } from "../services/agentHarness.js";
import { getCheckpoint } from "../store/taskStore.js";

/**
 * POST /api/releases/start
 * Starts (or resumes after crash) the Agent Harness for a release version.
 */
export async function startReleaseNotes(req, res) {
    try {
        const { taskId, releaseVersion } = req.body;

        if (!taskId || !releaseVersion) {
            return res.status(400).json({ error: "taskId and releaseVersion are required" });
        }

        // Runs the harness loop until it pauses at AWAITING_APPROVAL or fails
        const resultState = await runReleaseNotesHarness(taskId, releaseVersion);

        return res.status(200).json({
            message: `Harness finished with status: ${resultState.status}`,
            task: resultState,
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

/**
 * GET /api/releases/:taskId
 * Lets the frontend/PM inspect the saved checkpoint state and generated draft.
 */
export function getReleaseTaskStatus(req, res) {
    const { taskId } = req.params;
    const state = getCheckpoint(taskId);

    if (!state) {
        return res.status(404).json({ error: `Task ${taskId} not found` });
    }

    return res.status(200).json({ task: state });
}

/**
 * POST /api/releases/:taskId/approve
 * Human-in-the-Loop (HITL) endpoint: approves (and optionally edits) the draft to publish.
 */
export async function approveReleaseTask(req, res) {
    try {
        const { taskId } = req.params;
        const { editedDraft } = req.body || {}; // Optional: human can tweak the markdown before publishing

        const publishedState = await approveAndPublishTask(taskId, editedDraft);

        return res.status(200).json({
            message: "Release notes approved and published!",
            task: publishedState,
        });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
}