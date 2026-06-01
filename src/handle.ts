import { executeDecision } from "./agent/decision.ts"
import { runAgent } from "./agent/run.ts"
import { connectOpenStatus } from "./openstatus/mcp.ts"
import type { WebhookEvent } from "./webhook/schema.ts"

export async function handleEvent(event: WebhookEvent): Promise<void> {
    const client = await connectOpenStatus()
    try {
        const decision = await runAgent(event, client)
        console.log("[agent-webhook] decision", JSON.stringify(decision))
        await executeDecision(decision, client)
    } finally {
        await client.close()
    }
}
