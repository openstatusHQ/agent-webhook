import { generateText, Output, stepCountIs } from "ai"

import { env } from "../env.ts"
import type { OpenStatusClient } from "../openstatus/mcp.ts"
import type { WebhookEvent } from "../webhook/schema.ts"
import { Decision, type DecisionType } from "./decision.ts"
import { buildSystemPrompt, describeEvent } from "./prompt.ts"

export async function runAgent(
    event: WebhookEvent,
    client: OpenStatusClient
): Promise<DecisionType> {
    const result = await generateText({
        model: env.AGENT_MODEL,
        system: buildSystemPrompt(),
        prompt: describeEvent(event),
        tools: client.readTools,
        stopWhen: stepCountIs(8),
        output: Output.object({ schema: Decision })
    })
    return result.output
}
