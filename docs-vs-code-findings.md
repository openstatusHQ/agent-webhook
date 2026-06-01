# OpenStatus: docs vs. source — findings

Dogfooding notes for the agent-webhook build. Where the public docs and the
actual code disagree, **the code wins** — these are the gaps to fix in the docs.

## Method

Running in a sandbox with no local OpenStatus checkout, so source was read via
the GitHub API (`raw.githubusercontent.com/openstatusHQ/openstatus@main`), docs
from `docs.openstatus.dev`, SDK presence from the npm registry. No write access
to the OpenStatus repo — findings only.

## TL;DR (most important first)

1. **MCP exposes monitor + response-log read tools — the docs page omits them
   entirely.** Biggest gap. The agent *can* investigate real check data.
2. **The MCP `/reference/mcp-server` page lists 9 tools; the server registers ~6
   tool groups** (page, status-report, maintenance, monitor, notification,
   audit) — docs undercount.
3. **Webhook payload is one flat schema**, not the failure/recovery split the
   docs imply. All extra fields are optional on every status.
4. **`@openstatus/sdk-node` is real and on npm (`0.1.6`)** but lives in a
   *separate* repo (`openstatushq/sdk-node`), not the monorepo. Young.
5. **No webhook signing/HMAC** — custom headers are the only auth. By design.

---

## Verified contracts

### Webhook payload (what our `/webhook` receives)

Source: `packages/notifications/webhook/src/schema.ts` + `index.ts`.

```ts
PayloadSchema = {
  monitor: { id: number, name: string, url: string },
  cronTimestamp: number,
  status: "degraded" | "error" | "recovered",
  statusCode?: number,
  latency?: number,
  errorMessage?: string,
}
```

- **One flat schema** for all three statuses. `statusCode` / `latency` /
  `errorMessage` are *optional on every status* — the sender populates all of
  them on failure, degraded, *and* recovery (`sendAlert`/`sendDegraded`/
  `sendRecovery` all `PayloadSchema.parse` the same shape).
- Custom headers: supported — `transformHeaders(notificationData.webhook.headers)`.
  So `x-webhook-secret` works.
- **No signing** — `sendAlert` just `fetch`es JSON with content-type + the
  configured custom headers. No HMAC, no signature header.
- `sendTest` fires a `status:"recovered"` payload (`monitor.id=1`, name `"test"`,
  latency `1337`) — useful to recognise test pings.

### MCP server

Source: `apps/server/src/routes/mcp/server.ts` + `tools/*` + agent-tool
definitions in `packages/services/src/agent-tools/*`.

- URL `https://api.openstatus.dev/mcp`, stateless HTTP + JSON-RPC 2.0, auth
  header `x-openstatus-key`. Per-request server; workspace/actor scoped via the
  key. Read vs read-write enforced by key scope.
- **Registered tool groups:** page, status-report, maintenance, **monitor**,
  **notification**, **audit**.

**Monitor read tools (ALL undocumented on the MCP reference page):**

| Tool | Purpose |
|---|---|
| `list_monitors` | discover numeric monitorId; incl. `activeIncidentCount` |
| `get_monitor` | monitor config |
| `get_monitor_status` | status over window `1d`/`7d`/`14d` |
| `get_monitor_summary` | uptime/latency aggregates + timing breakdown (dns/connect/tls/ttfb/transfer), `1d`/`7d`/`14d` |
| `list_response_logs` | individual check results — `requestStatus` (success/error/degraded), `statusCode`, `latency`, `region`, timestamps; paginated (limit ≤100) |
| `get_response_log` | single response log by id |

**Status report tools** (`scope`/`destructive` from source):

| Tool | scope | notify |
|---|---|---|
| `list_status_reports` | read | — |
| `create_status_report` | write (destructive) | yes |
| `add_status_report_update` | write (destructive) | yes |
| `update_status_report` | write (destructive) | **none** (metadata only) |
| `resolve_status_report` | write (destructive) | yes |

- Report status enum: `investigating | identified | monitoring | resolved`.
- `create_status_report` needs `pageId` (from `list_status_pages`) +
  optional `pageComponentIds` (from `list_page_components`).
- Notify tools return a `notified` field; the report/update **persists even if
  the notify dispatch fails**.

### SDK

- `@openstatus/sdk-node` published to npm, latest **`0.1.6`**, repo
  `github.com/openstatushq/sdk-node` (separate from the monorepo).
- `createOpenStatusClient({ apiKey, baseUrl? })`; base URL defaults to
  `https://api.openstatus.dev/rpc` (note the `/rpc`, not the bare root our
  `.env.example` uses). `whoami` to check key scope.

---

## Disparities (docs vs. code)

| # | Docs say | Code says | Impact |
|---|---|---|---|
| 1 | MCP read tools = pages/components/reports/maintenances only | MCP also exposes 6 monitor tools incl. `get_monitor_summary` + `list_response_logs` | **Agent CAN investigate real check data.** Resolves the open agent-data question. |
| 2 | "9 MCP tools" | 6 tool *groups* (page, status-report, maintenance, monitor, notification, audit) | Docs undercount; notification + audit tools undocumented |
| 3 | Webhook: separate failure (`errorMessage`) vs recovery (`statusCode`/`latency`) payloads | Single flat schema; all extras optional on every status | Our `WebhookPayload` should be one flat schema, not a discriminated union |
| 4 | `notify` "required, no default; schema rejects omission" | Schema field is a required `z.boolean()`, **but** MCP registration injects it via a host `extraFlags`/`applyFlags` layer defaulting to `false` (`flags.notify ?? false`), overriding the model | Host can force `notify:false` regardless of the model — stronger safety than docs describe |
| 5 | SDK presented as first-class | Real on npm but `0.1.6`, separate repo, not in monorepo | Maturity/risk note for committing to the SDK |
| 6 | Webhook auth via custom headers | Confirmed — and **no signing path exists** | Shared-secret header is the only option (our approach is correct) |
| 7 | Webhook payload documented under `/reference/notification` only | — | Discoverability gap: nothing under `/integrations/webhook` |

---

## What's missing / would help

- **MCP docs** should list the monitor, response-log, notification, and audit
  tools, and fix the "9 tools" count.
- **Webhook docs** should show the single flat schema (not a failure/recovery
  split) and state that all extra fields are optional on every status.
- **Webhook auth**: document that there is no payload signature — only custom
  headers — so integrators know a shared secret is the only verification.
- **SDK docs** should state the package version/maturity and that it is a
  separate repo.

---

## Impact on the agent-webhook plan

- **Agent data source (was pinned): resolved.** The agent investigates via
  `get_monitor_status` + `get_monitor_summary` (uptime/latency over 1d/7d/14d)
  and `list_response_logs` / `get_response_log` (per-region error/statusCode/
  latency), plus `list_status_pages` / `list_page_components` /
  `list_status_reports` for context. It has enough to write a real
  "what's happening" message — no extra REST calls needed.
- **`WebhookPayload`** (currently referenced-but-undefined in `server.ts`) =
  the single flat schema above.
- **Writes via SDK**: viable but `0.1.6`; confirm it carries `notify` before
  committing, otherwise fall back to MCP write tools (notify confirmed, host
  default false) or raw `/rpc` calls.
- **`OPENSTATUS_API_URL`** in `.env.example` is the bare root; the SDK wants
  `…/rpc`. Reconcile.

---

## Docs files to modify (conformity upgrade)

All paths under `openstatusHQ/openstatus` (monorepo). One row per edit.

| Finding | File | Change |
|---|---|---|
| #1 | `apps/docs/src/content/docs/reference/mcp-server.mdx` | Add the **monitor tool group** — `list_monitors`, `get_monitor`, `get_monitor_status`, `get_monitor_summary`, `list_response_logs`, `get_response_log` (incl. the `1d`/`7d`/`14d` windows and response-log fields). |
| #2 | `apps/docs/src/content/docs/reference/mcp-server.mdx` | Fix the "9 tools" count; add the **notification** and **audit** tool groups so the list matches `server.ts` registration. |
| #4 | `apps/docs/src/content/docs/reference/mcp-server.mdx` | Correct the `notify` description: the schema field is required, but the MCP host layer (`extraFlags`/`applyFlags`) injects/overrides it with a **default of `false`** — not "no default". |
| #3 | `apps/docs/src/content/docs/reference/notification.mdx` | Replace the failure-vs-recovery split with the **single flat `PayloadSchema`**; state all extra fields (`statusCode`, `latency`, `errorMessage`) are optional on every status. |
| #6 | `apps/docs/src/content/docs/reference/notification.mdx` | Add an explicit note: **no payload signing/HMAC** — custom headers are the only auth (so a shared secret is the only verification). |
| #7 | `apps/docs/src/content/docs/reference/notification.mdx` | Discoverability: add an alias/redirect or cross-link from an `/integrations/webhook` slug, since the webhook payload is only reachable under `/reference/notification`. |
| #5 | `apps/docs/src/content/docs/sdk/nodejs/index.mdx` + `getting-started.mdx` | Note the package version/maturity (`0.1.6`) and that the SDK lives in a **separate repo** (`openstatushq/sdk-node`), not the monorepo. |
| #5 | `apps/docs/src/content/docs/sdk/nodejs/status-report-service.mdx` | Confirm/show the `notify` parameter on `createStatusReport` / `addStatusReportUpdate` and the `RESOLVED`-via-update path, so it matches the MCP tool semantics. |

Source-of-truth references for the edits:
`packages/notifications/webhook/src/{schema,index}.ts` (payload, headers, no
signing), `apps/server/src/routes/mcp/server.ts` + `tools/*` (registered
groups), `packages/services/src/agent-tools/{monitor,status-report}.ts` (tool
names, scopes, `notify`).
