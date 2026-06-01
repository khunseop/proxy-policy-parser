import { useState, useCallback } from 'react'

// React context 없이 module-level state로 간단하게 관리
// (단일 페이지 앱, 복잡한 상태 불필요)

let _currentSetId: number | null = null
const _listeners: Set<() => void> = new Set()

export function getCurrentSetId() {
  return _currentSetId
}

export function setCurrentSetId(id: number | null) {
  _currentSetId = id
  _listeners.forEach(fn => fn())
}

export function useCurrentSetId(): [number | null, (id: number | null) => void] {
  const [, rerender] = useState(0)

  const subscribe = useCallback(() => {
    const fn = () => rerender(n => n + 1)
    _listeners.add(fn)
    return () => { _listeners.delete(fn) }
  }, [])

  // 마운트 시 구독
  useState(subscribe)

  return [_currentSetId, setCurrentSetId]
}
