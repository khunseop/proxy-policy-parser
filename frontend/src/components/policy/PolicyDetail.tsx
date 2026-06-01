import type { Policy } from '../../api/types'
import { Badge } from '../common/Badge'
import styles from './PolicyDetail.module.css'

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
  if (!policy) return null

  const enabled = policy.Enabled === 'true'
  const expiry = detectExpiry(policy.Condition || '')

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
            <div className={styles.label}>Condition</div>
            <pre className={styles.cond}>{policy.Condition}</pre>
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
