// Sprint 3 — minimal chainable stub of the Supabase query builder for
// fail-closed unit tests. Each .from()/.rpc() consumes the next queued
// { data, error } result. The builder records the table and select-column
// strings so tests can assert exactly which columns a helper requests.

export interface StubResult {
  data: unknown
  error: { code?: string; message: string } | null
}

export interface RecordedCall {
  kind: 'from' | 'rpc'
  target: string
  columns?: string
  args?: unknown
}

export function makeStubClient(results: StubResult[]) {
  const queue = [...results]
  const calls: RecordedCall[] = []

  function nextResult(): StubResult {
    return queue.shift() ?? { data: null, error: { message: 'stub queue empty' } }
  }

  function makeBuilder(call: RecordedCall) {
    const result = nextResult()
    const builder: Record<string, unknown> = {}
    const chain = () => builder
    for (const m of ['eq', 'in', 'order', 'limit', 'update', 'delete']) {
      builder[m] = chain
    }
    builder.insert = (payload: unknown) => {
      call.args = payload
      return builder
    }
    builder.select = (columns: string) => {
      call.columns = columns
      return builder
    }
    builder.maybeSingle = () => Promise.resolve(result)
    builder.single = () => Promise.resolve(result)
    // Awaiting the builder itself (list queries) resolves the same result.
    builder.then = (
      onFulfilled: (v: StubResult) => unknown,
      onRejected?: (e: unknown) => unknown,
    ) => Promise.resolve(result).then(onFulfilled, onRejected)
    return builder
  }

  const client = {
    from(table: string) {
      const call: RecordedCall = { kind: 'from', target: table }
      calls.push(call)
      return makeBuilder(call)
    },
    rpc(fn: string, args?: unknown) {
      calls.push({ kind: 'rpc', target: fn, args })
      return Promise.resolve(nextResult())
    },
  }

  return { client, calls }
}
