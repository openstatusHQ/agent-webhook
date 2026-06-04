# agent-webhook

Receives OpenStatus monitor webhooks and runs an AI agent that drafts and
publishes a status-page report explaining what's happening.

On each event the agent investigates over OpenStatus's MCP server (read-only
tools: status pages, components, active reports, monitor status/summary,
response logs), then the orchestrator writes the result deterministically with
subscriber notifications disabled:

- `error` / `degraded` → create a report (or add an update if one is already
  active), one per status page the monitor appears on.
- `recovered` → resolve the active report.

The model only ever sees read tools and emits a structured decision; writes
happen in code with `notify: false`, so it can never notify subscribers or
double-post. With `DRY_RUN=true` (default) the decision is logged and nothing
is written.

## Setup

1. Install deps:

    ```sh
    deno install
    ```

2. Configure env (see `.env.example`):

    ```sh
    cp .env.example .env
    # fill in OPENSTATUS_API_KEY (write scope), AI_GATEWAY_API_KEY, WEBHOOK_SECRET
    ```

3. In OpenStatus, add a **Webhook** notification pointing at this server's
   `/webhook` endpoint, with a custom header `x-webhook-secret: <WEBHOOK_SECRET>`,
   and wire it to the monitors you want covered.

4. Run:

    ```sh
    deno task dev
    ```

5. Once the dry-run logs look right, set `DRY_RUN=false` to publish for real.

## Scripts

- `deno task dev` — run the server (watch mode).
- `deno task start` — run in production mode.
- `deno task mock [degraded|error|recovered]` — fire a randomised mock event at
  the server (`test.ts`); set `WEBHOOK_URL` / `WEBHOOK_SECRET` to match.
- `deno check src/server.ts` — type-check.
- `deno fmt` / `deno fmt --check` — format.

## Endpoints

- `GET /` — health check (`ok`).
- `POST /webhook` — OpenStatus webhook receiver. Verifies `x-webhook-secret`,
  validates the payload, dedupes, acks `202`, then processes in the background.

With the server running (`deno task dev`), hit it directly:

```sh
curl -X POST http://localhost:3000/webhook \
  -H 'content-type: application/json' -H 'x-webhook-secret: <secret>' \
  -d '{"monitor":{"id":1,"name":"API","url":"https://api.example.com"},"cronTimestamp":1730000000000,"status":"error","statusCode":500}'
```
