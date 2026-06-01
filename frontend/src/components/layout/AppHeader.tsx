import { useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchHistory, uploadXml, deleteHistoryItem, clearAllHistory } from '../../api/client'
import { useCurrentSetId } from '../../store/appStore'
import styles from './AppHeader.module.css'

export function AppHeader() {
  const [currentSetId, setCurrentSetId] = useCurrentSetId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const { data: history = [] } = useQuery({ queryKey: ['history'], queryFn: fetchHistory })

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const result = await uploadXml(file)
      await queryClient.invalidateQueries({ queryKey: ['history'] })
      setCurrentSetId(result.set_id)
    } catch (err) {
      alert('업로드 실패: ' + (err as Error).message)
    }
    e.target.value = ''
  }

  const handleDelete = async () => {
    if (!currentSetId) return
    if (!confirm('현재 이력을 삭제할까요?')) return
    await deleteHistoryItem(currentSetId)
    await queryClient.invalidateQueries({ queryKey: ['history'] })
    setCurrentSetId(null)
  }

  const handleClear = async () => {
    if (!confirm('전체 히스토리를 초기화할까요?')) return
    await clearAllHistory()
    await queryClient.invalidateQueries({ queryKey: ['history'] })
    setCurrentSetId(null)
  }

  return (
    <header className={styles.header}>
      <div className={styles.logo}>Skyhigh Policy Explorer</div>

      <div className={styles.mid}>
        <select
          value={currentSetId ?? ''}
          onChange={e => setCurrentSetId(e.target.value ? Number(e.target.value) : null)}
          className={styles.select}
        >
          <option value="">정책 선택...</option>
          {history.map(h => (
            <option key={h._pk_auto} value={h._pk_auto}>
              {h.filename} ({h.upload_time.slice(0, 10)})
            </option>
          ))}
        </select>
        <button onClick={handleDelete} title="현재 이력 삭제" disabled={!currentSetId}>🗑️</button>
        <button onClick={handleClear} title="전체 히스토리 초기화">🧹</button>
      </div>

      <div className={styles.right}>
        <input ref={fileInputRef} type="file" accept=".xml" style={{ display: 'none' }} onChange={handleUpload} />
        <button className="primary" onClick={() => fileInputRef.current?.click()}>XML 업로드</button>
      </div>
    </header>
  )
}
