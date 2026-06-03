import arkenv from "arkenv"
import { env as processEnv } from "node:process"

export const env = arkenv(
    {
        OPENSTATUS_API_URL: "string = 'https://api.openstatus.dev'",
        OPENSTATUS_API_KEY: "string",
        AI_GATEWAY_API_KEY: "string",
        AGENT_MODEL: "string = 'anthropic/claude-haiku-4.5'",
        WEBHOOK_SECRET: "string",
        DRY_RUN: "boolean = true",
        PORT: "number = 3000"
    },
    { env: { ...processEnv } }
)
