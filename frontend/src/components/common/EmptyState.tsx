import styles from './EmptyState.module.css'

interface Props { message: string; sub?: string }

export function EmptyState({ message, sub }: Props) {
  return (
    <div className={styles.wrap}>
      <div className={styles.msg}>{message}</div>
      {sub && <div className={styles.sub}>{sub}</div>}
    </div>
  )
}
