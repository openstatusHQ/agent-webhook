// Fires a randomised mock OpenStatus webhook at the running agent-webhook.
// Usage: node test.ts [degraded|error|recovered]
// Env: WEBHOOK_URL (default http://localhost:3000/webhook), WEBHOOK_SECRET

export {}

const STATUSES = ["degraded", "error", "recovered"] as const
type Status = (typeof STATUSES)[number]

const MONITOR_NAMES = [
    "API",
    "Web App",
    "Auth Service",
    "Checkout",
    "CDN",
    "Database",
    "Search",
    "Webhooks"
]
const MONITOR_HOSTS = [
    "api.example.com",
    "app.example.com",
    "auth.example.com",
    "checkout.example.com"
]
const ERROR_STATUS_CODES = [429, 500, 502, 503, 504]
const ERROR_MESSAGES = [
    "connect ETIMEDOUT",
    "Internal Server Error",
    "502 Bad Gateway",
    "Service Unavailable",
    "request timed out after 45000ms",
    "ECONNREFUSED"
]

type Payload = {
    monitor: { id: number; name: string; url: string }
    cronTimestamp: number
    status: Status
    statusCode?: number
    latency?: number
    errorMessage?: string
}

function pick<T>(items: readonly T[]): T {
    return items[Math.floor(Math.random() * items.length)]
}

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

function buildPayload(status: Status): Payload {
    const payload: Payload = {
        monitor: {
            id: randomInt(1, 500),
            name: pick(MONITOR_NAMES),
            url: `https://${pick(MONITOR_HOSTS)}`
        },
        cronTimestamp: Date.now(),
        status
    }

    if (status === "recovered") {
        payload.statusCode = 200
        payload.latency = randomInt(40, 400)
        return payload
    }

    if (status === "degraded") {
        payload.statusCode = pick([200, 201, 206])
        payload.latency = randomInt(1000, 8000)
        payload.errorMessage = pick([
            "latency above degraded threshold",
            "slow response"
        ])
        return payload
    }

    payload.statusCode = pick(ERROR_STATUS_CODES)
    payload.latency = randomInt(2000, 45000)
    payload.errorMessage = pick(ERROR_MESSAGES)
    return payload
}

const arg = process.argv[2]
const status: Status =
    arg !== undefined && (STATUSES as readonly string[]).includes(arg)
        ? (arg as Status)
        : pick(STATUSES)

const url = process.env.WEBHOOK_URL ?? "http://localhost:8000/webhook"
const secret = process.env.WEBHOOK_SECRET ?? ""
const payload = buildPayload(status)

console.log(`POST ${url}`)
console.log(JSON.stringify(payload, null, 2))

const res = await fetch(url, {
    method: "POST",
    headers: {
        "content-type": "application/json",
        "x-webhook-secret": secret
    },
    body: JSON.stringify(payload)
})

console.log(`\n${res.status} ${res.statusText}`)
console.log(await res.text())
