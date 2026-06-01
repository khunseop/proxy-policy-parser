import { useQuery } from '@tanstack/react-query'
import * as api from '../api/client'
import type { SearchParams } from '../api/client'

export const useHistory = () =>
  useQuery({ queryKey: ['history'], queryFn: api.fetchHistory })

export const usePolicies = (setId: number | null, params: SearchParams = {}) =>
  useQuery({
    queryKey: ['policies', setId, params],
    queryFn: () => api.searchPolicies(setId!, { limit: 2000, ...params }),
    enabled: !!setId,
  })

export const useObjects = (setId: number | null) =>
  useQuery({
    queryKey: ['objects', setId],
    queryFn: () => api.fetchObjects(setId!),
    enabled: !!setId,
    staleTime: Infinity, // 리스트는 세션 내 불변
  })

export const usePolicyStats = (setId: number | null) =>
  useQuery({
    queryKey: ['policyStats', setId],
    queryFn: () => api.fetchPolicyStats(setId!),
    enabled: !!setId,
  })

export const useTopHosts = (setId: number | null) =>
  useQuery({
    queryKey: ['topHosts', setId],
    queryFn: () => api.fetchTopHosts(setId!),
    enabled: !!setId,
  })
