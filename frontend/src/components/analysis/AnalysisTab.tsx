import { useState } from 'react'
import { StatsView } from './StatsView'
import { ValueLookup } from './ValueLookup'
import { BatchLookup } from './BatchLookup'
import styles from './AnalysisTab.module.css'

type SubTab = 'stats' | 'value' | 'batch'

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'stats', label: '📊 정책 통계' },
  { id: 'value', label: '🔍 값 조회' },
  { id: 'batch', label: '📋 배치 조회' },
]

export function AnalysisTab({ setId }: { setId: number }) {
  const [sub, setSub] = useState<SubTab>('stats')

  return (
    <div className={styles.tab}>
      <div className={styles.subTabs}>
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            className={`${styles.subTab} ${sub === t.id ? styles.active : ''}`}
            onClick={() => setSub(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className={styles.content}>
        {sub === 'stats' && <StatsView setId={setId} />}
        {sub === 'value' && <ValueLookup setId={setId} />}
        {sub === 'batch' && <BatchLookup setId={setId} />}
      </div>
    </div>
  )
}
