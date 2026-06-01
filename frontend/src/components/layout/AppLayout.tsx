import { useState } from 'react'
import { useCurrentSetId } from '../../store/appStore'
import { PolicyTab } from '../policy/PolicyTab'
import { ListsTab } from '../lists/ListsTab'
import { AnalysisTab } from '../analysis/AnalysisTab'
import { DiffTab } from '../diff/DiffTab'
import { EmptyState } from '../common/EmptyState'
import styles from './AppLayout.module.css'

type Tab = 'policy' | 'lists' | 'analysis' | 'diff'

const TABS: { id: Tab; label: string }[] = [
  { id: 'policy',   label: '📋 Policy' },
  { id: 'lists',    label: '📦 Lists' },
  { id: 'analysis', label: '📊 Analysis' },
  { id: 'diff',     label: '⚖️ Diff' },
]

export function AppLayout() {
  const [currentSetId] = useCurrentSetId()
  const [activeTab, setActiveTab] = useState<Tab>('policy')

  return (
    <div className={styles.layout}>
      <div className={styles.tabBar}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`${styles.tab} ${activeTab === t.id ? styles.active : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {!currentSetId ? (
          <EmptyState message="정책을 선택하거나 업로드하세요." sub="우측 상단의 XML 업로드 버튼을 눌러 시작합니다." />
        ) : (
          <>
            {activeTab === 'policy'   && <PolicyTab   setId={currentSetId} />}
            {activeTab === 'lists'    && <ListsTab    setId={currentSetId} />}
            {activeTab === 'analysis' && <AnalysisTab setId={currentSetId} />}
            {activeTab === 'diff'     && <DiffTab     setId={currentSetId} />}
          </>
        )}
      </div>
    </div>
  )
}
