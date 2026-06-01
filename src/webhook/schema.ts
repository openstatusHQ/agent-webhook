import { type } from "arktype"

export const WebhookPayload = type({
    monitor: {
        id: "number",
        name: "string",
        url: "string"
    },
    cronTimestamp: "number",
    status: "'degraded' | 'error' | 'recovered'",
    "statusCode?": "number",
    "latency?": "number",
    "errorMessage?": "string"
})

export type WebhookEvent = typeof WebhookPayload.infer
