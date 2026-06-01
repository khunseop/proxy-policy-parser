import { useState, useMemo } from 'react'
import { usePolicies } from '../../hooks/useQueries'
import { PolicyFilters, type Filters } from './PolicyFilters'
import { PolicyTable } from './PolicyTable'
import { PolicyDetail } from './PolicyDetail'
import { EmptyState } from '../common/EmptyState'
import type { Policy } from '../../api/types'
import styles from './PolicyTab.module.css'

const DEFAULT_FILTERS: Filters = {
  keyword: '',
  type: 'all',
  enabled: 'all',
  expiry: 'all',
  fields: 'all',
}

export function PolicyTab({ setId }: { setId: number }) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const { data: allPolicies = [], isLoading } = usePolicies(setId, { limit: 20000 })

  const handleToggleGroup = (path: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })
  }

  const handleExport = () => {
    const a = document.createElement('a')
    a.href = `/api/v1/objects/${setId}/export-all`
    a.download = ''
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const filteredCount = useMemo(() => {
    const kw = filters.keyword.toLowerCase()
    return allPolicies.filter(p => {
      if (filters.type !== 'all' && p.Type !== filters.type) return false
      if (filters.enabled !== 'all' && p.Enabled !== filters.enabled) return false
      if (kw) {
        const targets: string[] = []
        if (filters.fields === 'all' || filters.fields === 'name')      targets.push(p.Name || '')
        if (filters.fields === 'all' || filters.fields === 'condition') targets.push(p.Condition || '')
        if (filters.fields === 'all' || filters.fields === 'actions')   targets.push(p.Actions || '')
        if (!targets.some(t => t.toLowerCase().includes(kw))) return false
      }
      return true
    }).length
  }, [allPolicies, filters])

  if (isLoading) return <EmptyState message="정책 로딩 중..." />

  return (
    <div className={styles.tab}>
      <PolicyFilters
        filters={filters}
        onChange={setFilters}
        onExport={handleExport}
        total={allPolicies.length}
        visible={filteredCount}
      />

      <div className={styles.tableArea}>
        <PolicyTable
          policies={allPolicies}
          filters={filters}
          onSelect={setSelectedPolicy}
          selectedPk={selectedPolicy?._pk_auto ?? null}
          collapsedGroups={collapsedGroups}
          onToggleGroup={handleToggleGroup}
        />

        {selectedPolicy && (
          <PolicyDetail
            policy={selectedPolicy}
            onClose={() => setSelectedPolicy(null)}
          />
        )}
      </div>
    </div>
  )
}
