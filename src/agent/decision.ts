import { type } from "arktype"

import { env } from "../env.ts"
import type { OpenStatusClient } from "../openstatus/mcp.ts"

const Action = type({
    action: "'create' | 'update' | 'resolve'",
    reason: "string",
    message: "string",
    pageId: "number",
    "status?": "'investigating' | 'identified' | 'monitoring'",
    "title?": "string",
    "pageComponentIds?": "number[]",
    "statusReportId?": "number"
})

export const Decision = type({
    summary: "string",
    actions: Action.array()
})

export type DecisionType = typeof Decision.infer

export async function executeDecision(
    decision: DecisionType,
    client: OpenStatusClient
): Promise<void> {
    if (env.DRY_RUN) {
        console.log(
            "[agent-webhook] dry-run, not writing",
            JSON.stringify(decision)
        )
        return
    }

    for (const action of decision.actions) {
        const status = action.status ?? "investigating"

        if (action.action === "create") {
            if (action.title === undefined) {
                console.warn(
                    "[agent-webhook] skip create: missing title",
                    action
                )
                continue
            }
            await client.createReport({
                title: action.title,
                status,
                message: action.message,
                pageId: action.pageId,
                pageComponentIds: action.pageComponentIds ?? []
            })
            console.log(
                `[agent-webhook] created status report on page ${action.pageId}`
            )
            continue
        }

        if (action.statusReportId === undefined) {
            console.warn(
                `[agent-webhook] skip ${action.action}: missing statusReportId`,
                action
            )
            continue
        }

        if (action.action === "update") {
            await client.addUpdate({
                statusReportId: action.statusReportId,
                status,
                message: action.message
            })
            console.log(
                `[agent-webhook] updated status report #${action.statusReportId}`
            )
            continue
        }

        await client.resolveReport({
            statusReportId: action.statusReportId,
            message: action.message
        })
        console.log(
            `[agent-webhook] resolved status report #${action.statusReportId}`
        )
    }
}
