// API client for rstmdb Studio

const API_BASE = '/api/v1'

export class ApiError extends Error {
  code: string
  details?: unknown

  constructor(code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const error = body.error || {}
    throw new ApiError(
      error.code || 'UNKNOWN_ERROR',
      error.message || response.statusText,
      error.details
    )
  }
  return response.json()
}

// Helper for GET requests with credentials
async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
  })
  return handleResponse<T>(res)
}

// Helper for POST requests with credentials
async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  })
  return handleResponse<T>(res)
}

// Auth
export const auth = {
  async login(username: string, password: string) {
    return post<{ username: string }>('/auth/login', { username, password })
  },

  async logout() {
    return post<{ logged_out: boolean }>('/auth/logout')
  },

  async me() {
    return get<{ username: string; logged_in: boolean }>('/auth/me')
  },
}

// Machines
export interface Machine {
  machine: string
  versions: number[]
  latest_version: number
  states_count: number
  transitions_count: number
}

export interface MachineDefinition {
  states: string[]
  initial: string
  transitions: Array<{
    from: string | string[]
    event: string
    to: string
    guard?: string
  }>
  meta?: Record<string, unknown>
}

export interface ValidationResult {
  valid: boolean
  errors: Array<{ code: string; message: string; path?: string }>
  warnings: Array<{ code: string; message: string; path?: string }>
}

export const machines = {
  async list() {
    return get<{ items: Machine[] }>('/machines')
  },

  async get(name: string) {
    return get<{ machine: string; versions: number[] }>(`/machines/${name}`)
  },

  async getVersion(name: string, version: number) {
    return get<{
      machine: string
      version: number
      definition: MachineDefinition
      checksum: string
    }>(`/machines/${name}/versions/${version}`)
  },

  async createVersion(
    name: string,
    definition: MachineDefinition,
    options?: { version?: number; baseVersion?: number }
  ) {
    return post<{
      machine: string
      version: number
      checksum: string
      created: boolean
    }>(`/machines/${name}/versions`, {
      version: options?.version,
      definition,
      base_version: options?.baseVersion,
    })
  },

  async validate(definition: unknown) {
    return post<ValidationResult>('/machines/validate', { definition })
  },
}

// Instances
export interface Instance {
  id: string
  machine: string
  version: number
  state: string
  created_at: number
  updated_at: number
  last_wal_offset: number
}

export interface InstanceDetail {
  instance_id: string
  machine: string
  version: number
  state: string
  ctx: Record<string, unknown>
  last_wal_offset: number
}

export interface HistoryEvent {
  offset: number
  event_type: 'created' | 'transition'
  event?: string
  from_state?: string
  to_state: string
  timestamp: number
  ctx?: Record<string, unknown>
}

export const instances = {
  async list(machine: string, params?: { state?: string; limit?: number; offset?: number }) {
    const query = new URLSearchParams()
    query.set('machine', machine)
    if (params?.state) query.set('state', params.state)
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.offset) query.set('offset', String(params.offset))
    return get<{ items: Instance[]; total: number; has_more: boolean }>(`/instances?${query}`)
  },

  async get(id: string) {
    return get<InstanceDetail>(`/instances/${id}`)
  },

  async getHistory(id: string) {
    return get<{ instance_id: string; events: HistoryEvent[] }>(`/instances/${id}/history`)
  },
}

// WAL
export interface WalEntry {
  sequence: number
  offset: number
  entry_type: string
  instance_id?: string
  machine?: string
  version?: number
  details: Record<string, unknown>
}

export interface WalStats {
  entry_count: number
  segment_count: number
  total_size_bytes: number
  latest_offset: number | null
  io_stats: {
    bytes_written: number
    bytes_read: number
    writes: number
    reads: number
    fsyncs: number
  }
}

export const wal = {
  async list(params?: { from?: number; limit?: number }) {
    const query = new URLSearchParams()
    if (params?.from !== undefined) query.set('from', String(params.from))
    if (params?.limit !== undefined) query.set('limit', String(params.limit))
    return get<{ records: WalEntry[]; next_offset?: number }>(`/wal?${query}`)
  },

  async get(offset: number) {
    return get<{ sequence: number; offset: number; entry: unknown }>(`/wal/${offset}`)
  },

  async stats() {
    return get<WalStats>('/wal/stats')
  },
}

// Server
export const server = {
  async info() {
    return get<{
      studio_version: string
      rstmdb: {
        connected: boolean
        server_name: string
        server_version: string
        protocol_version: number
        features: string[]
      }
    }>('/server/info')
  },

  async health() {
    return get<{
      status: string
      rstmdb_connected: boolean
      latency_ms: number
    }>('/server/health')
  },
}
