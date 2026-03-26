import { NavLink } from 'react-router-dom'
import { useApp } from '@/context/AppContext'
import Icon from './Icon'
import styles from './Sidebar.module.css'

const nav = [
  { to: '/',            icon: 'home',     label: 'Dashboard'       },
  { to: '/participants',icon: 'users',    label: 'Participants'     },
  { to: '/form',        icon: 'form',     label: 'Intake form'     },
  { to: '/guide',       icon: 'mic',      label: 'Interview guide' },
  { to: '/comms',       icon: 'mail',     label: 'Comms hub'       },
]

export default function Sidebar() {
  const { user, workspace, signOut } = useApp()

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <span className={styles.logoText}>Interview<span className={styles.logoAccent}>OS</span></span>
        <span className={styles.logoSub}>Research platform</span>
      </div>

      {/* Nav */}
      <nav className={styles.nav}>
        {nav.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.active : ''}`
            }
          >
            <Icon name={icon} size={15} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Workspace + user */}
      <div className={styles.footer}>
        {workspace && (
          <div className={styles.workspace}>
            <div className={styles.workspaceLabel}>Workspace</div>
            <div className={styles.workspaceName}>{workspace.name}</div>
          </div>
        )}
        <div className={styles.userRow}>
          {user?.user_metadata?.avatar_url && (
            <img
              src={user.user_metadata.avatar_url}
              alt="avatar"
              className={styles.avatar}
            />
          )}
          <div className={styles.userInfo}>
            <div className={styles.userName}>
              {user?.user_metadata?.full_name || user?.email?.split('@')[0]}
            </div>
            <div className={styles.userEmail}>{user?.email}</div>
          </div>
          <button className={`btn btn-ghost btn-icon ${styles.signOut}`} onClick={signOut} title="Sign out">
            <Icon name="logout" size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}
