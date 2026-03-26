import { useEffect } from 'react'
import Icon from './Icon'

export default function Modal({ title, onClose, children, maxWidth = 540 }) {
  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
          <h2>{title}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <Icon name="x" size={15} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
