import styles from './Badge.module.css'

type BadgeVariant = 'enabled' | 'disabled' | 'group' | 'rule' | 'expired' | 'expiring' | 'neutral'

interface Props {
  variant: BadgeVariant
  children: React.ReactNode
}

export function Badge({ variant, children }: Props) {
  return <span className={`${styles.badge} ${styles[variant]}`}>{children}</span>
}
