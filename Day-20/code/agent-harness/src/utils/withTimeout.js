/**
 * Runs an async function with a strict time limit.
 *
 * @param {Function} asyncFn - A function that receives an AbortSignal: (signal) => Promise
 * @param {number} timeoutMs - Max time allowed in milliseconds
 * @param {string} stepName  - Name of the step (for clear error logs)
 */
export async function withTimeout(asyncFn, timeoutMs, stepName = "Operation") {
    // AbortController lets us cancel in-flight HTTP requests (like fetch or OpenAI) when time runs out
    const controller = new AbortController();

    // Start a countdown timer that triggers controller.abort() if time expires
    const timer = setTimeout(() => {
        controller.abort();
    }, timeoutMs);

    try {
        // Pass controller.signal into the function so it can cancel its network request immediately
        const result = await asyncFn(controller.signal);
        return result;
    } catch (error) {

        if (controller.signal.aborted || error.name === "AbortError") {
            throw new Error(`[Timeout] ${stepName} took longer than ${timeoutMs}ms`);
        }
        throw error; // Otherwise re-throw the original error (e.g., network down, invalid API key)
    } finally {
        clearTimeout(timer);
    }
}