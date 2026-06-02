import { executeDecision } from "./agent/decision.ts"
import { runAgent } from "./agent/run.ts"
import { env } from "./env.ts"
import { connectOpenStatus } from "./openstatus/mcp.ts"
import type { WebhookEvent } from "./webhook/schema.ts"

export async function handleEvent(
    event: WebhookEvent,
    receivedAt: number
): Promise<void> {
    const label = `${event.status} ${event.monitor.name} (#${event.monitor.id})`

    console.log(`[agent-webhook] connecting to OpenStatus — ${label}`)
    const client = await connectOpenStatus()
    try {
        console.log(`[agent-webhook] running agent — ${label}`)
        const decision = await runAgent(event, client)
        console.log(
            `[agent-webhook] decision — ${label}`,
            JSON.stringify(decision)
        )
        await executeDecision(decision, client)
        const elapsedMs = Math.round(performance.now() - receivedAt)
        const mode = env.DRY_RUN ? "dry-run" : "written"
        console.log(
            `[agent-webhook] done — ${label} in ${elapsedMs}ms (${mode}, ${decision.actions.length} action(s))`
        )
    } finally {
        await client.close()
    }
}
