import { useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Policy } from '../../api/types'
import { Badge } from '../common/Badge'
import type { Filters } from './PolicyFilters'
import styles from './PolicyTable.module.css'

interface Props {
  policies: Policy[]
  filters: Filters
  onSelect: (policy: Policy) => void
  selectedPk: number | null
  collapsedGroups: Set<string>
  onToggleGroup: (path: string) => void
}

function detectExpiry(condition: string) {
  const m = condition?.match(/date\s*[<>]=?\s*["']?(\d{4}-\d{2}-\d{2})/i)
  if (!m) return null
  const end = new Date(m[1])
  const diff = Math.ceil((end.getTime() - Date.now()) / 86400000)
  return { expired: diff < 0, expiringSoon: diff >= 0 && diff <= 30, daysLeft: diff }
}

function condSummary(condition: string) {
  if (!condition || condition === 'Always' || condition === 'None') return ''
  return condition.length > 80 ? condition.slice(0, 80) + '…' : condition
}

function getDepth(path: string) {
  if (!path) return 0
  return path.split(' > ').length - 1
}

export function PolicyTable({ policies, filters, onSelect, selectedPk, collapsedGroups, onToggleGroup }: Props) {
  const parentRef = useRef<HTMLDivElement>(null)

  // 키워드 검색은 서버에서 처리됨 — 클라이언트는 type/enabled/expiry만 필터
  const filtered = useMemo(() => {
    const needsFilter = filters.type !== 'all' || filters.enabled !== 'all' || filters.expiry !== 'all'
    if (!needsFilter) return policies
    return policies.filter(p => {
      if (filters.type !== 'all' && p.Type !== filters.type) return false
      if (filters.enabled !== 'all' && p.Enabled !== filters.enabled) return false
      if (filters.expiry !== 'all') {
        const exp = detectExpiry(p.Condition || '')
        if (filters.expiry === 'expired'  && !exp?.expired)      return false
        if (filters.expiry === 'expiring' && !exp?.expiringSoon) return false
      }
      return true
    })
  }, [policies, filters])

  // 접힌 그룹 하위 숨기기 (필터 적용 후)
  const visible = useMemo(() => {
    if (!collapsedGroups.size) return filtered
    return filtered.filter(p => {
      // 이 행의 ParentPath가 접힌 그룹의 Path로 시작하면 숨김
      for (const gPath of collapsedGroups) {
        if (p.ParentPath === gPath || p.ParentPath.startsWith(gPath + ' > ')) return false
      }
      return true
    })
  }, [filtered, collapsedGroups])

  const rowVirtualizer = useVirtualizer({
    count: visible.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 30,
  })

  return (
    <div className={styles.tableWrap}>
      {/* 헤더 */}
      <div className={styles.thead}>
        <div className={styles.colDepth}>Depth</div>
        <div className={styles.colName}>이름</div>
        <div className={styles.colType}>유형</div>
        <div className={styles.colEnabled}>상태</div>
        <div className={styles.colCond}>Condition</div>
        <div className={styles.colActions}>Actions</div>
        <div className={styles.colPath}>Path</div>
      </div>

      {/* 바디 (가상스크롤) */}
      <div ref={parentRef} className={styles.tbody}>
        <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map(vRow => {
            const p = visible[vRow.index]
            const isGroup = p.Type === 'Group'
            const depth = getDepth(p.Path)
            const isSelected = p._pk_auto === selectedPk
            const expiry = detectExpiry(p.Condition || '')
            const isCollapsed = isGroup && collapsedGroups.has(p.Path)

            return (
              <div
                key={p._pk_auto}
                className={`${styles.row} ${isGroup ? styles.groupRow : styles.ruleRow} ${isSelected ? styles.selected : ''}`}
                style={{ position: 'absolute', top: vRow.start, left: 0, right: 0, height: vRow.size }}
                onClick={() => {
                  if (isGroup) onToggleGroup(p.Path)
                  onSelect(p)
                }}
              >
                <div className={styles.colDepth}>
                  <span className={styles.depthNum}>{depth}</span>
                </div>
                <div className={styles.colName} style={{ paddingLeft: depth * 12 + 8 }}>
                  <span className={styles.icon}>{isGroup ? (isCollapsed ? '▶' : '▼') : '·'}</span>
                  <span className={`${styles.nameText} ${isGroup ? styles.groupName : ''}`}>{p.Name}</span>
                </div>
                <div className={styles.colType}>
                  <Badge variant={isGroup ? 'group' : 'rule'}>{p.Type}</Badge>
                </div>
                <div className={styles.colEnabled}>
                  <Badge variant={p.Enabled === 'true' ? 'enabled' : 'disabled'}>
                    {p.Enabled === 'true' ? '활성' : '비활성'}
                  </Badge>
                  {expiry?.expired    && <Badge variant="expired">만료</Badge>}
                  {expiry?.expiringSoon && !expiry.expired && <Badge variant="expiring">D-{expiry.daysLeft}</Badge>}
                </div>
                <div className={`${styles.colCond} ${styles.mono}`} title={p.Condition}>
                  {condSummary(p.Condition || '')}
                </div>
                <div className={styles.colActions} title={p.Actions}>{p.Actions}</div>
                <div className={styles.colPath} title={p.Path}>
                  {p.Path.split(' > ').pop()}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export { getDepth }
