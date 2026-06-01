import type {
  PolicySet, Policy, ListEntry, PolicyStats,
  TopHost, BatchLookupResult, DiffResult, UploadResult,
} from './types'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || res.statusText)
  }
  return res.json()
}

// ── History ──────────────────────────────────────────────────────────────────

export const fetchHistory = () =>
  request<PolicySet[]>('/api/v1/history')

export const deleteHistoryItem = (setId: number) =>
  fetch(`/api/v1/history/${setId}`, { method: 'DELETE' })

export const clearAllHistory = () =>
  fetch('/api/v1/history', { method: 'DELETE' })

// ── Upload ───────────────────────────────────────────────────────────────────

export const uploadXml = async (file: File): Promise<UploadResult> => {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch('/api/v1/upload', { method: 'POST', body: fd })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || res.statusText)
  }
  return res.json()
}

// ── Policies ─────────────────────────────────────────────────────────────────

export interface SearchParams {
  query?: string
  enabled?: string
  exact?: string
  fields?: string
  limit?: number
  page?: number
  page_size?: number
}

export const fetchPolicies = (setId: number, parentPath = '') =>
  request<Policy[]>(`/api/v1/policies/${setId}?parent_path=${encodeURIComponent(parentPath)}`)

export const searchPolicies = (setId: number, params: SearchParams = {}) => {
  const { query = '', enabled = '', exact = '0', fields = 'all', limit = 500 } = params
  const qs = new URLSearchParams({ query, enabled, exact, fields, limit: String(limit) })
  return request<Policy[]>(`/api/v1/policies/${setId}/search?${qs}`)
}

// ── Objects (Lists) ──────────────────────────────────────────────────────────

export const fetchObjects = (setId: number) =>
  request<ListEntry[]>(`/api/v1/objects/${setId}`)

export const downloadAllListsExcel = (setId: number) => {
  const a = document.createElement('a')
  a.href = `/api/v1/objects/${setId}/export-all`
  a.download = ''
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

// ── Analysis ─────────────────────────────────────────────────────────────────

export const fetchTopHosts = (setId: number, limit = 200) =>
  request<TopHost[]>(`/api/v1/analysis/${setId}/top-hosts?limit=${limit}`)

export const fetchPolicyStats = (setId: number) =>
  request<PolicyStats>(`/api/v1/analysis/${setId}/policy-stats`)

export const valueLookup = (setId: number, value: string) =>
  request<{ value: string; found_in_lists: string[]; policies: Policy[]; count: number }>(
    `/api/v1/analysis/${setId}/value-lookup?value=${encodeURIComponent(value)}`
  )

export const valueLookupBatch = (setId: number, values: string[]) =>
  request<BatchLookupResult>(`/api/v1/analysis/${setId}/value-lookup-batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values }),
  })

export const downloadBatchLookupExcel = async (setId: number, values: string[]) => {
  const res = await fetch(`/api/v1/analysis/${setId}/value-lookup-batch/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values }),
  })
  if (!res.ok) throw new Error('Excel 생성 실패')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `batch-lookup-${setId}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Diff ─────────────────────────────────────────────────────────────────────

export const fetchDiff = (setA: number, setB: number) =>
  request<DiffResult>(`/api/v1/diff?set_a=${setA}&set_b=${setB}`)
