import { createHash, timingSafeEqual } from "node:crypto"

import { type } from "arktype"
import { Hono } from "hono"
import { serve } from "srvx"

import { eventKey, markIfNew } from "./dedup.ts"
import { env } from "./env.ts"
import { handleEvent } from "./handle.ts"
import { WebhookPayload } from "./webhook/schema.ts"

function safeEqual(a: string, b: string): boolean {
    const ah = createHash("sha256").update(a).digest()
    const bh = createHash("sha256").update(b).digest()
    return timingSafeEqual(ah, bh)
}

const app = new Hono()

app.get("/", (c) => {
    return c.text("ok")
})

app.post("/webhook", async (c) => {
    if (
        !safeEqual(c.req.header("x-webhook-secret") ?? "", env.WEBHOOK_SECRET)
    ) {
        return c.json({ error: "unauthorized" }, 401)
    }

    const payload = WebhookPayload(await c.req.json())
    if (payload instanceof type.errors) {
        return c.json({ error: payload.summary }, 400)
    }

    const key = eventKey(
        payload.monitor.id,
        payload.cronTimestamp,
        payload.status
    )
    if (!markIfNew(key)) {
        return c.json({ status: "duplicate" }, 200)
    }

    void handleEvent(payload).catch((error) => {
        console.error("[agent-webhook] handleEvent failed", error)
    })

    return c.json({ status: "accepted" }, 202)
})

serve({ port: env.PORT, fetch: app.fetch })
