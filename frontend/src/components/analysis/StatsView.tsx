import { useState } from 'react'
import { usePolicyStats, useTopHosts } from '../../hooks/useQueries'
import { EmptyState } from '../common/EmptyState'
import styles from './StatsView.module.css'

interface Props { setId: number }

type SortCol = 'entry_value' | 'policy_count'
type SortDir = 'asc' | 'desc'

export function StatsView({ setId }: Props) {
  const { data: stats } = usePolicyStats(setId)
  const { data: hosts = [], isLoading } = useTopHosts(setId)
  const [sortCol, setSortCol] = useState<SortCol>('policy_count')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const pct = (v: number, t: number) => t > 0 ? Math.round(v / t * 100) : 0

  const sorted = [...hosts].sort((a, b) => {
    const va = sortCol === 'policy_count' ? a.policy_count : a.entry_value
    const vb = sortCol === 'policy_count' ? b.policy_count : b.entry_value
    if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va)
    return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
  })

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir(col === 'policy_count' ? 'desc' : 'asc') }
  }

  const CARDS = stats ? [
    { label: '전체 정책',   value: stats.total,          sub: `Rule ${stats.rules} · Group ${stats.groups}`, color: 'var(--primary)', icon: '📋' },
    { label: '활성 정책',   value: stats.enabled,         sub: `Rule의 ${pct(stats.enabled, stats.rules)}%`,  color: '#1a7a3d',        icon: '✅' },
    { label: '비활성 정책', value: stats.disabled,        sub: `Rule의 ${pct(stats.disabled, stats.rules)}%`, color: '#86868b',        icon: '⏸' },
    { label: '차단 정책',   value: stats.block,           sub: `Rule의 ${pct(stats.block, stats.rules)}%`,    color: '#c0392b',        icon: '🚫' },
    { label: '무조건 실행', value: stats.unconditional,   sub: '조건 없는 Rule',                              color: '#d4680a',        icon: '⚡' },
    { label: '비활성 차단', value: stats.disabled_block,  sub: '꺼진 차단 정책',                              color: '#8e44ad',        icon: '🔕' },
  ] : []

  const si = (col: SortCol) => sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ⇅'

  return (
    <div className={styles.wrap}>
      {/* 통계 카드 */}
      {stats && (
        <div className={styles.cards}>
          {CARDS.map(c => (
            <div key={c.label} className={styles.card}>
              <div className={styles.cardIcon}>{c.icon}</div>
              <div>
                <div className={styles.cardVal} style={{ color: c.color }}>{c.value.toLocaleString()}</div>
                <div className={styles.cardLabel}>{c.label}</div>
                <div className={styles.cardSub}>{c.sub}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Host 통계 테이블 */}
      <div className={styles.tableHeader}>
        <span className={styles.tableTitle}>📊 Host 통계</span>
        <span className={styles.tableCount}>{hosts.length}개 항목</span>
      </div>

      {isLoading ? (
        <EmptyState message="분석 중..." />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th onClick={() => toggleSort('entry_value')}>Value{si('entry_value')}</th>
                <th onClick={() => toggleSort('policy_count')}>참조 정책 수{si('policy_count')}</th>
                <th>소속 Lists</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={i}>
                  <td className={styles.mono}>{r.entry_value}</td>
                  <td className={styles.countCell}>{r.policy_count}</td>
                  <td className={styles.listNames}>{r.list_names}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
