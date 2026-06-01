import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { searchPolicies } from '../../api/client'
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

  const hasKeyword = filters.keyword.trim().length > 0

  // 키워드 없을 때: 기본 전체 로드 (limit 3000, 캐시됨)
  const { data: basePolicies = [], isLoading: baseLoading } = useQuery({
    queryKey: ['policies-base', setId],
    queryFn: () => searchPolicies(setId, { limit: 3000 }),
    enabled: !!setId,
    staleTime: Infinity,
  })

  // 키워드 있을 때: 서버 검색 (디바운스된 keyword 기준)
  const { data: searchResult = [], isFetching: searching } = useQuery({
    queryKey: ['policies-search', setId, filters.keyword, filters.fields],
    queryFn: () => searchPolicies(setId, {
      query: filters.keyword,
      fields: filters.fields,
      limit: 2000,
    }),
    enabled: !!setId && hasKeyword,
    staleTime: 30000,
  })

  const sourcePolicies = hasKeyword ? searchResult : basePolicies
  const isLoading = baseLoading && !hasKeyword

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

  if (isLoading) return <EmptyState message="정책 로딩 중..." />

  return (
    <div className={styles.tab}>
      <PolicyFilters
        filters={filters}
        onChange={setFilters}
        onExport={handleExport}
        total={basePolicies.length}
        visible={sourcePolicies.length}
      />

      {searching && (
        <div className={styles.searchingBar}>🔍 검색 중...</div>
      )}

      <div className={styles.tableArea}>
        <PolicyTable
          policies={sourcePolicies}
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
