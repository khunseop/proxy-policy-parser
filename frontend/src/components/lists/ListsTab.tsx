import { useState, useMemo } from 'react'
import { useObjects } from '../../hooks/useQueries'
import { downloadAllListsExcel } from '../../api/client'
import type { ListSummary } from '../../api/types'
import { EmptyState } from '../common/EmptyState'
import { ListEntries } from './ListEntries'
import styles from './ListsTab.module.css'

function buildSummaries(entries: ReturnType<typeof useObjects>['data']): ListSummary[] {
  if (!entries) return []
  const map = new Map<string, ListSummary>()
  for (const e of entries) {
    if (!map.has(e.list_id)) {
      map.set(e.list_id, {
        list_id: e.list_id,
        list_name: e.list_name,
        list_type_id: e.list_type_id,
        entry_count: 0,
        entries: [],
      })
    }
    const s = map.get(e.list_id)!
    s.entry_count++
    s.entries.push({ value: e.entry_value, type: e.entry_type, details: e.entry_details })
  }
  return Array.from(map.values()).sort((a, b) => a.list_name.localeCompare(b.list_name))
}

export function ListsTab({ setId }: { setId: number }) {
  const { data: rawEntries = [], isLoading } = useObjects(setId)
  const [keyword, setKeyword] = useState('')
  const [valueSearch, setValueSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const summaries = useMemo(() => buildSummaries(rawEntries), [rawEntries])

  const filtered = useMemo(() => {
    const kw = keyword.toLowerCase()
    const vs = valueSearch.toLowerCase()
    if (!kw && !vs) return summaries
    return summaries.filter(s => {
      if (kw && !s.list_name.toLowerCase().includes(kw)) return false
      if (vs && !s.entries.some(e => (e.value || '').toLowerCase().includes(vs))) return false
      return true
    })
  }, [summaries, keyword, valueSearch])

  const selected = useMemo(() => summaries.find(s => s.list_id === selectedId) ?? null, [summaries, selectedId])

  if (isLoading) return <EmptyState message="리스트 로딩 중..." />

  return (
    <div className={styles.tab}>
      {/* 검색 바 */}
      <div className={styles.searchBar}>
        <input
          placeholder="🔍 리스트 이름 검색..."
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          className={styles.input}
        />
        <input
          placeholder="🔍 값으로 검색 (포함 검색)..."
          value={valueSearch}
          onChange={e => setValueSearch(e.target.value)}
          className={styles.input}
        />
        <span className={styles.count}>{filtered.length} / {summaries.length}개 리스트</span>
        <button onClick={() => downloadAllListsExcel(setId)}>⬇️ 전체 Excel</button>
      </div>

      {/* 2열 레이아웃 */}
      <div className={styles.body}>
        {/* 왼쪽: 리스트 목록 */}
        <div className={styles.listPanel}>
          {filtered.length === 0 ? (
            <EmptyState message="리스트 없음" />
          ) : (
            filtered.map(s => (
              <div
                key={s.list_id}
                className={`${styles.listItem} ${selectedId === s.list_id ? styles.active : ''}`}
                onClick={() => setSelectedId(s.list_id)}
              >
                <span className={styles.listIcon}>📦</span>
                <span className={styles.listName}>{s.list_name}</span>
                <span className={styles.listCount}>{s.entry_count.toLocaleString()}</span>
              </div>
            ))
          )}
        </div>

        {/* 오른쪽: 선택된 리스트 항목 */}
        <div className={styles.entryPanel}>
          {selected ? (
            <ListEntries summary={selected} highlight={valueSearch} setId={setId} />
          ) : (
            <EmptyState message="왼쪽에서 리스트를 선택하세요." />
          )}
        </div>
      </div>
    </div>
  )
}
