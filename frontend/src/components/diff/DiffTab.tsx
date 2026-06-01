import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchHistory, fetchDiff } from '../../api/client'
import type { DiffResult, DiffChangedPolicy, DiffChangedList } from '../../api/types'
import { Badge } from '../common/Badge'
import { EmptyState } from '../common/EmptyState'
import styles from './DiffTab.module.css'

type Section = 'pol_added' | 'pol_removed' | 'pol_changed' | 'lst_added' | 'lst_removed' | 'lst_changed'

export function DiffTab({ setId: _setId }: { setId: number }) {
  const { data: history = [] } = useQuery({ queryKey: ['history'], queryFn: fetchHistory })
  const [setA, setSetA] = useState<string>('')
  const [setB, setSetB] = useState<string>('')
  const [diff, setDiff] = useState<DiffResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [section, setSection] = useState<Section | null>(null)

  const runDiff = async () => {
    if (!setA || !setB || setA === setB) { setError('서로 다른 파일을 선택해주세요.'); return }
    setLoading(true); setError(''); setDiff(null); setSection(null)
    try {
      const result = await fetchDiff(Number(setA), Number(setB))
      setDiff(result)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const counts = diff ? {
    pol_added:   diff.policies.added.length,
    pol_removed: diff.policies.removed.length,
    pol_changed: diff.policies.changed.length,
    lst_added:   diff.lists.added.length,
    lst_removed: diff.lists.removed.length,
    lst_changed: diff.lists.changed.length,
  } : null

  const SECTIONS: { id: Section; label: string; color: string }[] = [
    { id: 'pol_added',   label: '정책 추가',   color: '#1a7a3d' },
    { id: 'pol_removed', label: '정책 삭제',   color: '#c0392b' },
    { id: 'pol_changed', label: '정책 변경',   color: '#d4680a' },
    { id: 'lst_added',   label: '리스트 추가', color: '#1a7a3d' },
    { id: 'lst_removed', label: '리스트 삭제', color: '#c0392b' },
    { id: 'lst_changed', label: '리스트 변경', color: '#d4680a' },
  ]

  return (
    <div className={styles.tab}>
      {/* 선택 바 */}
      <div className={styles.selectBar}>
        <select value={setA} onChange={e => setSetA(e.target.value)} className={styles.select}>
          <option value="">A (기준) 선택...</option>
          {history.map(h => <option key={h._pk_auto} value={h._pk_auto}>{h.filename} ({h.upload_time.slice(0,10)})</option>)}
        </select>
        <span className={styles.arrow}>→</span>
        <select value={setB} onChange={e => setSetB(e.target.value)} className={styles.select}>
          <option value="">B (비교) 선택...</option>
          {history.map(h => <option key={h._pk_auto} value={h._pk_auto}>{h.filename} ({h.upload_time.slice(0,10)})</option>)}
        </select>
        <button className="primary" onClick={runDiff} disabled={loading}>
          {loading ? '비교 중...' : '⚖️ 비교 실행'}
        </button>
        {error && <span className={styles.error}>{error}</span>}
      </div>

      {!diff ? (
        <EmptyState message="비교할 파일 A, B를 선택하고 실행하세요." />
      ) : (
        <div className={styles.body}>
          {/* 왼쪽 섹션 목록 */}
          <div className={styles.sidePanel}>
            <div className={styles.diffMeta}>
              <div className={styles.diffFile}>A: {diff.set_a.filename}</div>
              <div className={styles.diffFile}>B: {diff.set_b.filename}</div>
            </div>
            <div className={styles.sectionLabel}>정책</div>
            {SECTIONS.slice(0, 3).map(s => (
              <button
                key={s.id}
                className={`${styles.sectionBtn} ${section === s.id ? styles.activeSection : ''}`}
                onClick={() => setSection(s.id)}
              >
                <span className={styles.sectionName}>{s.label}</span>
                <span className={styles.sectionCount} style={{ color: (counts?.[s.id] ?? 0) > 0 ? s.color : undefined }}>
                  {counts?.[s.id] ?? 0}
                </span>
              </button>
            ))}
            <div className={styles.sectionLabel}>리스트</div>
            {SECTIONS.slice(3).map(s => (
              <button
                key={s.id}
                className={`${styles.sectionBtn} ${section === s.id ? styles.activeSection : ''}`}
                onClick={() => setSection(s.id)}
              >
                <span className={styles.sectionName}>{s.label}</span>
                <span className={styles.sectionCount} style={{ color: (counts?.[s.id] ?? 0) > 0 ? s.color : undefined }}>
                  {counts?.[s.id] ?? 0}
                </span>
              </button>
            ))}
          </div>

          {/* 오른쪽 상세 */}
          <div className={styles.mainPanel}>
            {!section ? (
              <EmptyState message="왼쪽에서 항목을 선택하세요." />
            ) : (
              <DiffContent diff={diff} section={section} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function DiffContent({ diff, section }: { diff: DiffResult; section: Section }) {
  switch (section) {
    case 'pol_added':   return <PolicyCards items={diff.policies.added}   variant="added"   title="추가된 정책" />
    case 'pol_removed': return <PolicyCards items={diff.policies.removed} variant="removed" title="삭제된 정책" />
    case 'pol_changed': return <PolicyChangedCards items={diff.policies.changed} />
    case 'lst_added':   return <ListCards items={diff.lists.added}   variant="added"   title="추가된 리스트" />
    case 'lst_removed': return <ListCards items={diff.lists.removed} variant="removed" title="삭제된 리스트" />
    case 'lst_changed': return <ListChangedCards items={diff.lists.changed} />
  }
}

function PolicyCards({ items, variant, title }: { items: DiffResult['policies']['added']; variant: string; title: string }) {
  if (!items.length) return <EmptyState message={`${title}이 없습니다.`} />
  return (
    <div className={styles.cards}>
      {items.map((p, i) => (
        <div key={i} className={`${styles.card} ${styles[variant]}`}>
          <div className={styles.cardHeader}>
            <Badge variant={p.Type === 'Group' ? 'group' : 'rule'}>{p.Type}</Badge>
            {p.Enabled === 'false' && <Badge variant="disabled">비활성</Badge>}
            <span>{p.Name}</span>
          </div>
          <div className={styles.cardSub}>{p.Path || p.PolicyID}</div>
          {p.Condition && <div className={styles.cardCond}>{p.Condition.slice(0, 160)}</div>}
        </div>
      ))}
    </div>
  )
}

function PolicyChangedCards({ items }: { items: DiffChangedPolicy[] }) {
  if (!items.length) return <EmptyState message="변경된 정책이 없습니다." />
  return (
    <div className={styles.cards}>
      {items.map((item, i) => (
        <div key={i} className={`${styles.card} ${styles.changed}`}>
          <div className={styles.cardHeader}>
            <Badge variant="neutral">{item.a?.Type ?? 'Rule'}</Badge>
            <span>{item.changes.Name
              ? <><del>{item.changes.Name.a}</del> → <ins>{item.changes.Name.b}</ins></>
              : (item.b?.Name ?? item.a?.Name)
            }</span>
          </div>
          <div className={styles.cardSub}>{item.b?.Path ?? item.a?.Path ?? item.PolicyID}</div>
          {Object.entries(item.changes).filter(([k]) => k !== 'Name').map(([field, vals]) => (
            <div key={field} className={styles.changeRow}>
              <div className={styles.changeField}>{field}</div>
              <div className={styles.changeBefore}>{vals.a}</div>
              <div className={styles.changeAfter}>{vals.b}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function ListCards({ items, variant, title }: { items: DiffResult['lists']['added']; variant: string; title: string }) {
  if (!items.length) return <EmptyState message={`${title}이 없습니다.`} />
  return (
    <div className={styles.cards}>
      {items.map((l, i) => (
        <div key={i} className={`${styles.card} ${styles[variant]}`}>
          <div className={styles.cardHeader}>📦 {l.list_name}</div>
          <div className={styles.cardSub}>{l.list_id}</div>
        </div>
      ))}
    </div>
  )
}

const PREVIEW = 20
function ListChangedCards({ items }: { items: DiffChangedList[] }) {
  if (!items.length) return <EmptyState message="변경된 리스트가 없습니다." />
  return (
    <div className={styles.cards}>
      {items.map((l, i) => (
        <div key={i} className={`${styles.card} ${styles.changed}`}>
          <div className={styles.cardHeader}>📦 {l.list_name}</div>
          <div className={styles.cardSub}>{l.list_id} · A: {l.entry_count_a}개 → B: {l.entry_count_b}개</div>
          {l.entries_added.slice(0, PREVIEW).map((v, j) => <div key={j} className={styles.entryAdded}>+ {v}</div>)}
          {l.entries_added.length > PREVIEW && <div className={styles.more}>…외 {l.entries_added.length - PREVIEW}개 추가</div>}
          {l.entries_removed.slice(0, PREVIEW).map((v, j) => <div key={j} className={styles.entryRemoved}>- {v}</div>)}
          {l.entries_removed.length > PREVIEW && <div className={styles.more}>…외 {l.entries_removed.length - PREVIEW}개 삭제</div>}
        </div>
      ))}
    </div>
  )
}
