import { Client } from "@modelcontextprotocol/sdk/client"
// @ts-types="@modelcontextprotocol/sdk/client/streamableHttp"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { tool, type JSONValue, type Tool, type ToolSet } from "ai"
import { type, type Type } from "arktype"

import { env } from "../env.ts"

type JsonObject = { [key: string]: JSONValue }

type ReportStatus = "investigating" | "identified" | "monitoring"

export type CreateReportInput = {
    title: string
    status: ReportStatus
    message: string
    pageId: number
    pageComponentIds: number[]
}

export type AddUpdateInput = {
    statusReportId: number
    status: ReportStatus
    message: string
}

export type ResolveInput = {
    statusReportId: number
    message: string
}

export type OpenStatusClient = {
    readTools: ToolSet
    createReport: (input: CreateReportInput) => Promise<void>
    addUpdate: (input: AddUpdateInput) => Promise<void>
    resolveReport: (input: ResolveInput) => Promise<void>
    close: () => Promise<void>
}

const readToolSchemas = {
    list_status_pages: type({
        "page?": "number",
        "perPage?": "number"
    }),
    list_page_components: type({
        pageId: "number",
        "page?": "number",
        "perPage?": "number"
    }),
    list_status_reports: type({
        "filter?": "'active' | 'all'",
        "pageId?": "number",
        "page?": "number",
        "perPage?": "number"
    }),
    get_monitor: type({ monitorId: "number" }),
    get_monitor_status: type({ monitorId: "number" }),
    get_monitor_summary: type({
        monitorId: "number",
        "timeRange?": "'1d' | '7d' | '14d'"
    }),
    list_response_logs: type({
        monitorId: "number",
        "timeRange?": "'1d' | '7d' | '14d'",
        "limit?": "number",
        "offset?": "number"
    })
}

export async function connectOpenStatus(): Promise<OpenStatusClient> {
    const transport = new StreamableHTTPClientTransport(
        new URL(`${env.OPENSTATUS_API_URL}/mcp`),
        {
            requestInit: {
                headers: { "x-openstatus-key": env.OPENSTATUS_API_KEY }
            }
        }
    )
    const client = new Client({ name: "agent-webhook", version: "0.1.0" })
    await client.connect(transport)

    const readTool = <Schema extends Type>(
        name: string,
        schema: Schema
    ): Tool =>
        tool({
            description: `OpenStatus read tool: ${name}`,
            inputSchema: schema,
            execute: async (args) => {
                const result = await client.callTool({
                    name,
                    arguments: args as JsonObject
                })
                return JSON.stringify(
                    result.structuredContent ?? result.content
                )
            }
        })

    const readTools: ToolSet = {
        list_status_pages: readTool(
            "list_status_pages",
            readToolSchemas.list_status_pages
        ),
        list_page_components: readTool(
            "list_page_components",
            readToolSchemas.list_page_components
        ),
        list_status_reports: readTool(
            "list_status_reports",
            readToolSchemas.list_status_reports
        ),
        get_monitor: readTool("get_monitor", readToolSchemas.get_monitor),
        get_monitor_status: readTool(
            "get_monitor_status",
            readToolSchemas.get_monitor_status
        ),
        get_monitor_summary: readTool(
            "get_monitor_summary",
            readToolSchemas.get_monitor_summary
        ),
        list_response_logs: readTool(
            "list_response_logs",
            readToolSchemas.list_response_logs
        )
    }

    const write = async (name: string, args: JsonObject): Promise<void> => {
        await client.callTool({
            name,
            arguments: { ...args, notify: false }
        })
    }

    return {
        readTools,
        createReport: (input) =>
            write("create_status_report", {
                title: input.title,
                status: input.status,
                message: input.message,
                pageId: input.pageId,
                pageComponentIds: input.pageComponentIds
            }),
        addUpdate: (input) =>
            write("add_status_report_update", {
                statusReportId: input.statusReportId,
                status: input.status,
                message: input.message
            }),
        resolveReport: (input) =>
            write("resolve_status_report", {
                statusReportId: input.statusReportId,
                message: input.message
            }),
        close: () => client.close()
    }
}
