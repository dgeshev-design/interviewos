import { useApp } from '@/context/AppContext'
import Icon from '@/components/Icon'

export default function Login() {
  const { signInWithGoogle, authError } = useApp()

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-base)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20
    }}>
      <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
        {/* Logo */}
        <div style={{ marginBottom: 40 }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 800,
            letterSpacing: '-1px', color: 'var(--text-primary)'
          }}>
            Interview<span style={{ color: 'var(--accent-light)' }}>OS</span>
          </div>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginTop: 6 }}>
            Research platform
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: 36, textAlign: 'left' }}>
          <h2 style={{ marginBottom: 6 }}>Sign in</h2>
          <p className="text-sm muted" style={{ marginBottom: 28 }}>
            Access is restricted to{' '}
            <code style={{ background: 'var(--bg-raised)', padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>betty.com</code>,{' '}
            <code style={{ background: 'var(--bg-raised)', padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>uk.betty.com</code>{' '}
            and{' '}
            <code style={{ background: 'var(--bg-raised)', padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>playbetty.co.uk</code>{' '}
            email addresses.
          </p>

          {authError && (
            <div style={{
              background: 'rgba(240,79,79,0.08)', border: '1px solid rgba(240,79,79,0.2)',
              borderRadius: 'var(--r-md)', padding: '10px 14px',
              color: 'var(--red)', fontSize: 13, marginBottom: 20
            }}>
              {authError}
            </div>
          )}

          <button
            className="btn btn-ghost w-full"
            style={{ justifyContent: 'center', gap: 10, padding: '12px 16px', fontSize: 14 }}
            onClick={signInWithGoogle}
          >
            <Icon name="google" size={18} />
            Continue with Google
          </button>
        </div>

        <p className="text-xs" style={{ color: 'var(--text-tertiary)', marginTop: 24 }}>
          Each account has an isolated private workspace.
        </p>
      </div>
    </div>
  )
}
