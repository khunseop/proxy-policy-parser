import { useState } from 'react'
import { valueLookupBatch, downloadBatchLookupExcel } from '../../api/client'
import type { BatchLookupResult } from '../../api/types'
import { Badge } from '../common/Badge'
import styles from './BatchLookup.module.css'

interface Props { setId: number }

export function BatchLookup({ setId }: Props) {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<BatchLookupResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const [showUnmatched, setShowUnmatched] = useState(false)

  const parseValues = () => input.split(',').map(v => v.trim()).filter(Boolean)

  const search = async () => {
    const values = parseValues()
    if (!values.length) return
    setLoading(true); setError(''); setResult(null)
    try {
      setResult(await valueLookupBatch(setId, values))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const doExport = async () => {
    const values = parseValues()
    if (!values.length) return
    setExporting(true)
    try {
      await downloadBatchLookupExcel(setId, values)
    } catch (e) {
      alert('Excel 저장 실패: ' + (e as Error).message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.hint}>값을 콤마(,)로 구분하여 붙여넣으세요. 리스트 엔트리 정확 일치 + Condition 포함 검색을 함께 수행합니다.</div>
      <textarea
        className={styles.textarea}
        placeholder="google.com, 10.0.0.1, facebook.com, ..."
        value={input}
        onChange={e => setInput(e.target.value)}
        rows={5}
      />
      <div className={styles.btnRow}>
        <button className="primary" onClick={search} disabled={loading}>
          {loading ? '조회 중...' : `🔍 조회 (${parseValues().length}개)`}
        </button>
        <button onClick={doExport} disabled={exporting || !parseValues().length}>
          {exporting ? '생성 중...' : '⬇️ Excel 저장'}
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {result && (
        <div className={styles.result}>
          {/* 요약 */}
          <div className={styles.summary}>
            입력 <strong>{result.total_input}</strong>개 중 <strong>{result.matched_count}</strong>개 매칭
            &nbsp;·&nbsp; 정책 <strong>{result.policy_count}</strong>개 발견
          </div>

          {/* 미매칭 */}
          {result.unmatched_values.length > 0 && (
            <div className={styles.unmatchedWrap}>
              <button className={styles.unmatchedToggle} onClick={() => setShowUnmatched(v => !v)}>
                ⚠️ 미매칭 {result.unmatched_values.length}개 {showUnmatched ? '▲' : '▼'}
              </button>
              {showUnmatched && (
                <div className={styles.unmatchedList}>
                  {result.unmatched_values.map((v, i) => (
                    <span key={i} className={styles.unmatchedItem}>{v}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 정책 목록 */}
          {result.policies.length === 0 ? (
            <div className={styles.empty}>참조 정책이 없습니다.</div>
          ) : (
            <>
              <div className={styles.policyBar}>정책 목록 — {result.policy_count}개</div>
              <div className={styles.policyList}>
                {result.policies.map((p, i) => {
                const isCondMatch = (p as any).match_source === 'condition'
                const matchedVal  = (p as any).matched_value as string | undefined
                return (
                  <div key={i} className={styles.policyRow}>
                    <div className={styles.policyName}>
                      <Badge variant={p.Type === 'Group' ? 'group' : 'rule'}>{p.Type}</Badge>
                      <Badge variant={p.Enabled === 'true' ? 'enabled' : 'disabled'}>
                        {p.Enabled === 'true' ? '활성' : '비활성'}
                      </Badge>
                      <span>{p.Name}</span>
                      {isCondMatch
                        ? <span className={styles.condTag}>📝 Condition 직접 포함{matchedVal ? `: "${matchedVal}"` : ''}</span>
                        : p.list_name && <span className={styles.listTag}>📦 {p.list_name}</span>
                      }
                    </div>
                    <div className={styles.policyPath}>{p.Path}</div>
                    {p.Condition && (
                      <div className={styles.policyCond}>
                        {p.Condition.slice(0, 120)}{p.Condition.length > 120 ? '…' : ''}
                      </div>
                    )}
                  </div>
                )
              })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
