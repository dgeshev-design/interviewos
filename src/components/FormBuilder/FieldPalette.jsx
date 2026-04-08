import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

const PALETTE_TYPES = [
  { type: 'text',     label: 'Text',      preview: 'Short answer' },
  { type: 'email',    label: 'Email',     preview: 'email@example.com' },
  { type: 'tel',      label: 'Phone',     preview: '+1 (555) 000-0000' },
  { type: 'number',   label: 'Number',    preview: '0' },
  { type: 'textarea', label: 'Long text', preview: 'Paragraph answer…' },
  { type: 'select',   label: 'Dropdown',  preview: 'Select an option' },
  { type: 'heading',  label: 'Heading',   preview: 'Section title' },
  { type: 'divider',  label: 'Divider',   preview: '─────────────' },
]

function PaletteBlock({ type, label, preview }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: { type, isNew: true },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.4 : 1,
        cursor: 'grab',
        userSelect: 'none',
        touchAction: 'none',
        background: 'var(--bg-base)',
        border: '1px solid var(--border-base)',
        borderRadius: 8,
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        transition: 'border-color 0.12s, background 0.12s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--accent)'
        e.currentTarget.style.background = 'var(--accent-glow)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border-base)'
        e.currentTarget.style.background = 'var(--bg-base)'
      }}
    >
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
      <div style={{
        fontSize: 11, color: 'var(--text-tertiary)',
        background: 'var(--bg-raised)', borderRadius: 4,
        padding: '3px 6px', border: '1px dashed var(--border-base)',
        overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
      }}>
        {preview}
      </div>
    </div>
  )
}

export default function FieldPalette() {
  return (
    <div style={{ width: 180, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-tertiary)' }}>
        Elements
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {PALETTE_TYPES.map(p => (
          <PaletteBlock key={p.type} {...p} />
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 4 }}>
        Drag to add →
      </div>
    </div>
  )
}
