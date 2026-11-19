
const db = new Map();

//Creates the initial TaskState when a new release notes job starts.

export function createTask(taskId, releaseVersion) {
    const initialState = {
        taskId,
        releaseVersion,
        status: "CREATED",         // CREATED -> TICKETS_FETCHED -> DRAFTING -> AWAITING_APPROVAL -> PUBLISHED (or FAILED)
        attemptCount: 0,           // Tracks how many times the LLM has tried
        compactedTickets: [],      // Stores clean Jira tickets (4 fields instead of 80)
        currentDraft: "",          // Latest release notes written by the LLM
        validationErrors: [],      // Errors caught by Evaluator (used for Model Context Retries)
        updatedAt: new Date().toISOString(),
    };

    db.set(taskId, structuredClone(initialState));     //(Key = taskId, Value = taskState object)
    return structuredClone(initialState);
}


// Saves a (checkpoint) after any major step completes.

export function saveCheckpoint(taskId, updates) {
    const existing = db.get(taskId);
    if (!existing) {
        throw new Error(`Task ${taskId} not found in store`);
    }

    // Merge old state with new updates and record the save time
    const updatedState = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString(),
    };

    db.set(taskId, structuredClone(updatedState));
    console.log(`[Checkpoint Saved] Task: ${taskId} | Status: ${updatedState.status} | Attempt: ${updatedState.attemptCount}`);
    return structuredClone(updatedState);
}


// Loads the last saved checkpoint (used to inspect status or recover after a crash).

export function getCheckpoint(taskId) {
    const state = db.get(taskId);
    return state ? structuredClone(state) : null;
}