import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { searchPolicies } from '../../api/client'
import type { ListSummary } from '../../api/types'
import { Badge } from '../common/Badge'
import styles from './ListEntries.module.css'

interface Props {
  summary: ListSummary
  highlight: string
  setId: number
}

function hl(text: string, kw: string) {
  if (!kw) return text
  const idx = text.toLowerCase().indexOf(kw.toLowerCase())
  if (idx < 0) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: '#fff176', borderRadius: 2 }}>{text.slice(idx, idx + kw.length)}</mark>
      {text.slice(idx + kw.length)}
    </>
  )
}

export function ListEntries({ summary, highlight, setId }: Props) {
  const [entryFilter, setEntryFilter] = useState('')

  const { data: refPolicies = [], isLoading: polLoading } = useQuery({
    queryKey: ['listRefs', setId, summary.list_id],
    queryFn: () => searchPolicies(setId, { query: summary.list_name, fields: 'condition', limit: 500 }),
    staleTime: 60000,
  })

  const filteredEntries = useMemo(() => {
    const f = (entryFilter || highlight).toLowerCase()
    if (!f) return summary.entries
    return summary.entries.filter(e => (e.value || '').toLowerCase().includes(f))
  }, [summary.entries, entryFilter, highlight])

  return (
    <div className={styles.wrap}>
      {/* 헤더 */}
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.name}>{summary.list_name}</span>
          <span className={styles.meta}>{summary.list_id} · {filteredEntries.length} / {summary.entry_count}개</span>
        </div>
      </div>

      {/* 항목 검색 */}
      <div className={styles.searchRow}>
        <input
          placeholder="항목 검색..."
          value={entryFilter}
          onChange={e => setEntryFilter(e.target.value)}
          className={styles.input}
        />
      </div>

      {/* 항목 테이블 */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Value</th><th>Description</th><th>Type</th></tr>
          </thead>
          <tbody>
            {filteredEntries.length === 0 ? (
              <tr><td colSpan={3} className={styles.empty}>항목 없음</td></tr>
            ) : (
              filteredEntries.map((e, i) => (
                <tr key={i}>
                  <td className={styles.mono}>{hl(e.value || '', highlight || entryFilter)}</td>
                  <td className={styles.desc} title={e.details}>{e.details?.slice(0, 60)}{(e.details?.length ?? 0) > 60 ? '…' : ''}</td>
                  <td><Badge variant="neutral">{e.type}</Badge></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 참조 정책 */}
      <div className={styles.refsBar}>
        이 리스트를 참조하는 정책 {polLoading ? '— 로딩 중...' : `— ${refPolicies.length}개`}
      </div>
      <div className={styles.refs}>
        {refPolicies.map(p => (
          <div key={p._pk_auto} className={styles.refItem}>
            <div className={styles.refName}>
              <Badge variant={p.Type === 'Group' ? 'group' : 'rule'}>{p.Type}</Badge>
              {p.Name}
            </div>
            <div className={styles.refPath}>{p.Path}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
