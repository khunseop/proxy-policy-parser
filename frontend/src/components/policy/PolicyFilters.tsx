import { useState, useEffect, useRef } from 'react'
import styles from './PolicyFilters.module.css'

export interface Filters {
  keyword: string
  type: 'all' | 'Group' | 'Rule'
  enabled: 'all' | 'true' | 'false'
  expiry: 'all' | 'expired' | 'expiring'
  fields: 'all' | 'name' | 'condition' | 'actions'
}

interface Props {
  filters: Filters
  onChange: (f: Filters) => void
  onExport: () => void
  total: number
  visible: number
}

export function PolicyFilters({ filters, onChange, onExport, total, visible }: Props) {
  const [localKeyword, setLocalKeyword] = useState(filters.keyword)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 키워드: 로컬에서 즉시 반영, 300ms 디바운스 후 부모에 전달
  const handleKeyword = (value: string) => {
    setLocalKeyword(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      onChange({ ...filters, keyword: value })
    }, 300)
  }

  // 부모에서 keyword가 초기화되면 로컬도 초기화
  useEffect(() => {
    if (filters.keyword === '') setLocalKeyword('')
  }, [filters.keyword])

  const set = (patch: Partial<Omit<Filters, 'keyword'>>) => onChange({ ...filters, ...patch })

  return (
    <div className={styles.bar}>
      <input
        className={styles.search}
        placeholder="🔍 정책 검색..."
        value={localKeyword}
        onChange={e => handleKeyword(e.target.value)}
      />

      <select value={filters.fields} onChange={e => set({ fields: e.target.value as Filters['fields'] })}>
        <option value="all">전체 필드</option>
        <option value="name">이름</option>
        <option value="condition">Condition</option>
        <option value="actions">Actions</option>
      </select>

      <select value={filters.type} onChange={e => set({ type: e.target.value as Filters['type'] })}>
        <option value="all">유형: 전체</option>
        <option value="Group">그룹만</option>
        <option value="Rule">Rule만</option>
      </select>

      <select value={filters.enabled} onChange={e => set({ enabled: e.target.value as Filters['enabled'] })}>
        <option value="all">상태: 전체</option>
        <option value="true">활성만</option>
        <option value="false">비활성만</option>
      </select>

      <select value={filters.expiry} onChange={e => set({ expiry: e.target.value as Filters['expiry'] })}>
        <option value="all">만료: 전체</option>
        <option value="expired">만료됨</option>
        <option value="expiring">D-30 임박</option>
      </select>

      <span className={styles.count}>{visible} / {total}개</span>

      <button onClick={onExport}>⬇️ Excel</button>
    </div>
  )
}
