import { useState, useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import * as Popover from '@radix-ui/react-popover'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

const TYPE_LABELS = {
  text: 'Text', email: 'Email', tel: 'Phone', number: 'Number',
  textarea: 'Long text', select: 'Dropdown', heading: 'Heading', divider: 'Divider',
}

const CHANGE_TO_TYPES = ['text', 'email', 'tel', 'number', 'textarea', 'select']

function FieldPreview({ field }) {
  const base = {
    background: 'var(--bg-base)', border: '1px solid var(--border-base)',
    borderRadius: 6, color: 'var(--text-primary)',
    fontFamily: 'inherit', fontSize: 13, padding: '7px 10px',
    width: '100%', outline: 'none', pointerEvents: 'none',
  }
  if (field.field_type === 'heading') {
    return <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', paddingTop: 4 }}>{field.label || 'Section heading'}</div>
  }
  if (field.field_type === 'divider') {
    return <hr style={{ border: 'none', borderTop: '1px solid var(--border-base)', margin: '4px 0' }} />
  }
  if (field.field_type === 'textarea') {
    return <textarea readOnly style={{ ...base, minHeight: 64, resize: 'none' }} placeholder="Long answer…" />
  }
  if (field.field_type === 'select') {
    return (
      <select disabled style={{ ...base, cursor: 'not-allowed' }}>
        <option>Select…</option>
        {field.options?.map(o => <option key={o}>{o}</option>)}
      </select>
    )
  }
  return <input readOnly style={base} type={field.field_type} placeholder={TYPE_LABELS[field.field_type] || 'Answer'} />
}

function EditPopover({ field, onSave, onClose }) {
  const [label, setLabel]     = useState(field.label)
  const [required, setReq]    = useState(field.required)
  const [options, setOptions] = useState(field.options?.join(', ') || '')

  const handleSave = () => {
    const changes = { label, required }
    if (field.field_type === 'select') {
      changes.options = options ? options.split(',').map(s => s.trim()).filter(Boolean) : []
    }
    onSave(changes)
    onClose()
  }

  return (
    <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>Edit field</div>

      <div className="field">
        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Label</label>
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          style={{ background: 'var(--bg-base)', border: '1px solid var(--border-base)', borderRadius: 6, padding: '7px 10px', fontSize: 13, width: '100%', color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
          autoFocus
        />
      </div>

      {field.field_type === 'select' && (
        <div className="field">
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Options (comma-separated)</label>
          <input
            value={options}
            onChange={e => setOptions(e.target.value)}
            placeholder="Option A, Option B"
            style={{ background: 'var(--bg-base)', border: '1px solid var(--border-base)', borderRadius: 6, padding: '7px 10px', fontSize: 13, width: '100%', color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
      )}

      {field.field_type !== 'heading' && field.field_type !== 'divider' && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--text-primary)' }}>
          <input type="checkbox" checked={required} onChange={e => setReq(e.target.checked)} style={{ width: 'auto' }} />
          Required
        </label>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <button
          onClick={onClose}
          style={{ padding: '6px 12px', borderRadius: 6, background: 'transparent', border: '1px solid var(--border-base)', fontSize: 12.5, cursor: 'pointer', color: 'var(--text-secondary)' }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!label.trim()}
          style={{ padding: '6px 12px', borderRadius: 6, background: 'var(--accent)', border: 'none', fontSize: 12.5, cursor: 'pointer', color: '#fff', opacity: !label.trim() ? 0.4 : 1 }}
        >
          Save
        </button>
      </div>
    </div>
  )
}

export default function CanvasField({ field, onUpdate, onRemove, onChangeType }) {
  const [hovered, setHovered] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  }

  const isStatic = field.field_type === 'heading' || field.field_type === 'divider'

  return (
    <div
      ref={setNodeRef}
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { if (!editOpen) setHovered(false) }}
    >
      <div
        style={{
          position: 'relative',
          borderRadius: 8,
          padding: '10px 12px',
          border: hovered || editOpen ? '2px dashed var(--accent)' : '2px solid transparent',
          background: hovered || editOpen ? 'var(--accent-glow)' : 'var(--bg-card)',
          transition: 'border-color 0.15s, background 0.15s',
          outline: hovered || editOpen ? '0' : '1px solid var(--border-base)',
          outlineOffset: -1,
        }}
      >
        {/* Action bar */}
        {(hovered || editOpen) && (
          <div
            style={{
              position: 'absolute', top: -14, right: 8,
              display: 'flex', alignItems: 'center', gap: 2,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-base)',
              borderRadius: 6, padding: '2px 4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              zIndex: 10,
            }}
          >
            {/* Edit */}
            <Popover.Root open={editOpen} onOpenChange={open => { setEditOpen(open); if (!open) setHovered(false) }}>
              <Popover.Trigger asChild>
                <button
                  title="Edit field"
                  style={{ width: 24, height: 24, borderRadius: 4, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-raised)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  side="top"
                  align="end"
                  sideOffset={8}
                  style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border-base)',
                    borderRadius: 10, padding: 16,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.18)', zIndex: 100,
                  }}
                >
                  <EditPopover field={field} onSave={changes => onUpdate(field.id, changes)} onClose={() => setEditOpen(false)} />
                  <Popover.Arrow style={{ fill: 'var(--border-base)' }} />
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>

            {/* Change to */}
            {!isStatic && (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    title="Change field type"
                    style={{ width: 24, height: 24, borderRadius: 4, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-raised)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/>
                      <polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>
                    </svg>
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    sideOffset={6}
                    style={{
                      background: 'var(--bg-card)', border: '1px solid var(--border-base)',
                      borderRadius: 8, padding: 4, minWidth: 140,
                      boxShadow: '0 6px 24px rgba(0,0,0,0.14)', zIndex: 100,
                    }}
                  >
                    {CHANGE_TO_TYPES.filter(t => t !== field.field_type).map(t => (
                      <DropdownMenu.Item
                        key={t}
                        onSelect={() => onChangeType(field.id, t)}
                        style={{
                          padding: '7px 10px', borderRadius: 5, fontSize: 13, cursor: 'pointer',
                          color: 'var(--text-primary)', outline: 'none',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-raised)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        {TYPE_LABELS[t]}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            )}

            {/* Drag handle */}
            <button
              {...listeners}
              {...attributes}
              title="Drag to reorder"
              style={{ width: 24, height: 24, borderRadius: 4, background: 'transparent', border: 'none', cursor: 'grab', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', touchAction: 'none' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-raised)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="5" r="1" fill="currentColor" stroke="none"/>
                <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none"/>
                <circle cx="9" cy="19" r="1" fill="currentColor" stroke="none"/>
                <circle cx="15" cy="5" r="1" fill="currentColor" stroke="none"/>
                <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none"/>
                <circle cx="15" cy="19" r="1" fill="currentColor" stroke="none"/>
              </svg>
            </button>

            {/* Delete */}
            <button
              onClick={() => onRemove(field.id)}
              title="Remove field"
              style={{ width: 24, height: 24, borderRadius: 4, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </button>
          </div>
        )}

        {/* Field content */}
        <div style={{ pointerEvents: 'none' }}>
          {field.field_type !== 'heading' && field.field_type !== 'divider' && (
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 5 }}>
              {field.label || <span style={{ color: 'var(--text-tertiary)' }}>Untitled field</span>}
              {field.required && <span style={{ color: 'var(--red)', marginLeft: 3 }}>*</span>}
            </label>
          )}
          <FieldPreview field={field} />
        </div>
      </div>
    </div>
  )
}
