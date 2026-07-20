import { useState, useMemo } from 'react'
import type { Policy } from '../../api/types'
import { Badge } from '../common/Badge'
import styles from './PolicyDetail.module.css'

function formatCondition(cond: string): string {
  if (!cond) return ""
  
  const tokens = cond.split(/(\(|\)|(?:\s+AND\s+)|(?:\s+OR\s+))/i)
  let indent = 0
  const getIndentStr = (n: number) => "  ".repeat(n)
  
  let result = ""
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].trim()
    if (!token) continue
    
    if (token === "(") {
      if (result && !result.endsWith("\n")) {
        result += "\n"
      }
      result += getIndentStr(indent) + "(\n"
      indent++
    } else if (token === ")") {
      indent = Math.max(0, indent - 1)
      if (!result.endsWith("\n")) {
        result += "\n"
      }
      result += getIndentStr(indent) + ")"
    } else if (token.toUpperCase() === "AND" || token.toUpperCase() === "OR") {
      if (!result.endsWith("\n")) {
        result += "\n"
      }
      result += getIndentStr(indent) + token.toUpperCase() + " "
    } else {
      if (result.endsWith(" ")) {
        result += token
      } else {
        if (result && !result.endsWith("\n")) {
          result += "\n"
        }
        result += getIndentStr(indent) + token
      }
    }
  }
  
  return result.trim()
}

interface Props {
  policy: Policy | null
  onClose: () => void
}

function detectExpiry(condition: string) {
  const m = condition?.match(/date\s*[<>]=?\s*["']?(\d{4}-\d{2}-\d{2})/i)
  if (!m) return null
  const end = new Date(m[1])
  const now = new Date()
  const diff = Math.ceil((end.getTime() - now.getTime()) / 86400000)
  return { expired: diff < 0, expiringSoon: diff >= 0 && diff <= 30, daysLeft: diff, endDate: end }
}

export function PolicyDetail({ policy, onClose }: Props) {
  const [copied, setCopied] = useState(false)
  const [useFormatted, setUseFormatted] = useState(true)

  const formattedCond = useMemo(() => {
    if (!policy?.Condition) return ""
    return formatCondition(policy.Condition)
  }, [policy?.Condition])

  if (!policy) return null

  const enabled = policy.Enabled === 'true'
  const expiry = detectExpiry(policy.Condition || '')

  const handleCopy = () => {
    const textToCopy = useFormatted ? formattedCond : policy.Condition || ''
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className={styles.drawer}>
      <div className={styles.handle} />
      <div className={styles.header}>
        <div className={styles.title}>
          <span>{policy.Type === 'Group' ? '📁' : '📄'}</span>
          <span className={styles.name}>{policy.Name}</span>
          <Badge variant={enabled ? 'enabled' : 'disabled'}>{enabled ? '활성' : '비활성'}</Badge>
          {expiry?.expired    && <Badge variant="expired">만료됨</Badge>}
          {expiry?.expiringSoon && !expiry.expired && <Badge variant="expiring">D-{expiry.daysLeft}</Badge>}
        </div>
        <button className={styles.close} onClick={onClose}>✕</button>
      </div>

      <div className={styles.body}>
        <div className={styles.path}>{policy.Path}</div>

        {policy.Condition && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.label}>Condition</div>
              <div className={styles.actions}>
                <button 
                  className={styles.miniBtn} 
                  onClick={() => setUseFormatted(!useFormatted)}
                >
                  {useFormatted ? '원본 보기' : '포맷팅 보기'}
                </button>
                <button 
                  className={styles.miniBtn} 
                  onClick={handleCopy}
                >
                  {copied ? '✓ 복사됨' : '📋 복사'}
                </button>
              </div>
            </div>
            <pre className={styles.cond}>{useFormatted ? formattedCond : policy.Condition}</pre>
          </section>
        )}

        {policy.Actions && (
          <section className={styles.section}>
            <div className={styles.label}>Actions</div>
            <div className={styles.value}>{policy.Actions}</div>
          </section>
        )}

        {policy.Description && (
          <section className={styles.section}>
            <div className={styles.label}>Description</div>
            <div className={styles.value}>{policy.Description}</div>
          </section>
        )}

        <section className={styles.section}>
          <div className={styles.label}>기술 정보</div>
          <div className={styles.grid}>
            {[
              ['Type', policy.Type],
              ['Level', String(policy.Level ?? '-')],
              ['PolicyID', policy.PolicyID],
              ['CloudSynced', policy.CloudSynced === 'true' ? '✓' : '✗'],
              ['Enabled', policy.Enabled],
            ].map(([k, v]) => (
              <div key={k} className={styles.gridItem}>
                <div className={styles.gridKey}>{k}</div>
                <div className={styles.gridVal}>{v}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
