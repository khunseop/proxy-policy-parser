import { useState } from 'react'
import { valueLookup } from '../../api/client'
import { Badge } from '../common/Badge'
import styles from './ValueLookup.module.css'

interface Props { setId: number }

export function ValueLookup({ setId }: Props) {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<Awaited<ReturnType<typeof valueLookup>> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const search = async (value = input.trim()) => {
    if (!value) return
    setLoading(true); setError('')
    try {
      setResult(await valueLookup(setId, value))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.searchRow}>
        <input
          placeholder="IP, 도메인, URL 등..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          className={styles.input}
        />
        <button className="primary" onClick={() => search()} disabled={loading}>
          {loading ? '조회 중...' : '🔍 조회'}
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {result && (
        <>
          <div className={styles.summary}>
            "<strong>{result.value}</strong>" — {result.policies.length}개 정책, {result.found_in_lists.length}개 리스트에서 발견
          </div>
          {result.policies.length === 0 ? (
            <div className={styles.empty}>해당 값을 참조하는 정책이 없습니다.</div>
          ) : (
            <div className={styles.list}>
              {result.policies.map(p => (
                <div key={p._pk_auto} className={styles.policyRow}>
                  <div className={styles.policyName}>
                    <Badge variant={p.Type === 'Group' ? 'group' : 'rule'}>{p.Type}</Badge>
                    <Badge variant={p.Enabled === 'true' ? 'enabled' : 'disabled'}>
                      {p.Enabled === 'true' ? '활성' : '비활성'}
                    </Badge>
                    <span>{p.Name}</span>
                  </div>
                  <div className={styles.policyPath}>{p.Path}</div>
                  {p.Condition && <div className={styles.policyCond}>{p.Condition.slice(0, 120)}{p.Condition.length > 120 ? '…' : ''}</div>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
