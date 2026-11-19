import { withTimeout } from "../utils/withTimeout.js";
import { HARNESS_CONFIG } from "../config/openai.js";

/**
 * Simulates calling the Jira REST API and compacting the response.
 */
export async function fetchAndCompactJiraTickets(releaseVersion) {
    return withTimeout(
        async (signal) => {
            // Simulate a 400ms network call (respects AbortSignal if timeout triggers)
            await new Promise((resolve, reject) => {
                const timer = setTimeout(resolve, 400);
                signal.addEventListener("abort", () => {
                    clearTimeout(timer);
                    reject(new Error("Aborted"));
                });
            });

            // Raw Jira API response (in real life, each object has ~80 noisy fields)
            const rawJiraResponse = [
                {
                    key: "PAY-101",
                    fields: {
                        issuetype: { name: "Bug" },
                        summary: "Fix UPI payment timeout when bank server responds slowly",
                        description: "Increased gateway retry window and added fallback status check.",
                        reporter: { displayName: "Rahul", avatarUrl: "https://jira.example.com/a1.png", timeZone: "Asia/Kolkata" },
                        customfield_10042: "sprint-19-prod",
                    },
                },
                {
                    key: "UI-205",
                    fields: {
                        issuetype: { name: "Feature" },
                        summary: "Add dark mode toggle in user profile settings",
                        description: "Users can now switch between light and dark themes with saved preference.",
                        reporter: { displayName: "Ananya", avatarUrl: "https://jira.example.com/a2.png", timeZone: "Asia/Kolkata" },
                        customfield_10042: "sprint-19-prod",
                    },
                },
                {
                    key: "DB-309",
                    fields: {
                        issuetype: { name: "Internal" },
                        summary: "Upgrade PostgreSQL connection pooler and driver to v15",
                        description: "Internal backend maintenance. Do NOT show in customer release notes.",
                        reporter: { displayName: "Piyush", avatarUrl: "https://jira.example.com/a3.png", timeZone: "Asia/Kolkata" },
                        customfield_10042: "sprint-19-infra",
                    },
                },
            ];

            // CONTEXT COMPACTION: Strip out avatars, timezones, and custom fields.
            // Keep only the 4 clean fields so the LLM stays focused and uses fewer tokens.
            const compactedTickets = rawJiraResponse.map((ticket) => ({
                id: ticket.key,
                type: ticket.fields.issuetype.name,
                summary: ticket.fields.summary,
                notes: ticket.fields.description,
            }));

            console.log(`[JiraService] Fetched & compacted ${compactedTickets.length} tickets for ${releaseVersion}`);
            return compactedTickets;
        },
        HARNESS_CONFIG.TOOL_TIMEOUT_MS,
        "Fetch Jira Tickets"
    );
}

/**
 * Final tool executed ONLY after a human approves the release notes.
 */
export async function publishReleaseNotes(releaseVersion, finalMarkdown) {
    return withTimeout(
        async () => {
            // Simulate posting to Slack / GitHub Releases
            await new Promise((resolve) => setTimeout(resolve, 300));
            console.log(`\n🚀 [PUBLISHED ${releaseVersion} TO PRODUCTION]\n${finalMarkdown}\n`);
            return { published: true, publishedAt: new Date().toISOString() };
        },
        HARNESS_CONFIG.TOOL_TIMEOUT_MS,
        "Publish Release Notes"
    );
}