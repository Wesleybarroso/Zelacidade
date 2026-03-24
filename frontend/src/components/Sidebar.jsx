import styles from './Sidebar.module.scss'

export default function Sidebar() {
  return (
    <div className={styles.sidebar}>
      <h3>ZelaCidade</h3>
      <a href="/dashboard">Dashboard</a>
    </div>
  )
}