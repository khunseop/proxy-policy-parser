export interface PolicySet {
  _pk_auto: number
  filename: string
  upload_time: string
}

export interface Policy {
  _pk_auto: number
  set_id: number
  parent_pk: number
  Type: 'Group' | 'Rule'
  Name: string
  PolicyID: string
  Enabled: 'true' | 'false'
  Condition: string
  ConditionRaw: string
  Actions: string
  Path: string
  ParentPath: string
  Description: string
  Level: number
  CloudSynced: string
  CycleRequest: string
  CycleResponse: string
  CycleEmbedded: string
  DefaultRights: string
  ACElements: string
}

export interface ListEntry {
  _pk_auto: number
  set_id: number
  list_id: string
  list_name: string
  list_type_id: string
  entry_value: string
  entry_type: string
  entry_details: string
  list_description: string
}

export interface PolicyStats {
  total: number
  rules: number
  groups: number
  enabled: number
  disabled: number
  block: number
  unconditional: number
  disabled_block: number
}

export interface TopHost {
  entry_value: string
  policy_count: number
  list_names: string
}

export interface BatchLookupResult {
  total_input: number
  matched_count: number
  unmatched_values: string[]
  matched_values: Record<string, Array<{ list_id: string; list_name: string }>>
  policies: Array<Policy & { list_id: string; list_name: string }>
  policy_count: number
}

export interface DiffChangedPolicy {
  PolicyID: string
  changes: Record<string, { a: string; b: string }>
  a: Policy
  b: Policy
}

export interface DiffChangedList {
  list_id: string
  list_name: string
  entries_added: string[]
  entries_removed: string[]
  entry_count_a: number
  entry_count_b: number
}

export interface DiffResult {
  set_a: PolicySet
  set_b: PolicySet
  policies: {
    added: Policy[]
    removed: Policy[]
    changed: DiffChangedPolicy[]
    summary: { added: number; removed: number; changed: number; unchanged: number }
  }
  lists: {
    added: Array<{ list_id: string; list_name: string }>
    removed: Array<{ list_id: string; list_name: string }>
    changed: DiffChangedList[]
    summary: { added: number; removed: number; changed: number; unchanged: number }
  }
}

export interface UploadResult {
  message: string
  set_id: number
  summary: Record<string, unknown>
}

// 리스트 목록용 (objectsMap 형태로 가공)
export interface ListSummary {
  list_id: string
  list_name: string
  list_type_id: string
  entry_count: number
  entries: Array<{ value: string; type: string; details: string }>
}
