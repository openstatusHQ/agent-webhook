const TTL_MS = 10 * 60 * 1000

const seen = new Map<string, number>()

export function eventKey(
    monitorId: number,
    cronTimestamp: number,
    status: string
): string {
    return `${monitorId}:${cronTimestamp}:${status}`
}

export function markIfNew(key: string): boolean {
    const now = Date.now()
    for (const [seenKey, ts] of seen) {
        if (now - ts > TTL_MS) seen.delete(seenKey)
    }
    if (seen.has(key)) return false
    seen.set(key, now)
    return true
}
