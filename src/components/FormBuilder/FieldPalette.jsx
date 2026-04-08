import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

const PALETTE_TYPES = [
  { type: 'text',     label: 'Text',      icon: '𝐓',  preview: 'Short answer' },
  { type: 'email',    label: 'Email',     icon: '✉',  preview: 'email@example.com' },
  { type: 'tel',      label: 'Phone',     icon: '📞', preview: '+1 (555) 000-0000' },
  { type: 'number',   label: 'Number',    icon: '#',  preview: '0' },
  { type: 'textarea', label: 'Long text', icon: '¶',  preview: 'Paragraph answer…' },
  { type: 'select',   label: 'Dropdown',  icon: '▾',  preview: 'Select an option' },
  { type: 'heading',  label: 'Heading',   icon: 'H',  preview: 'Section title', isStatic: true },
  { type: 'divider',  label: 'Divider',   icon: '—',  preview: '────────────', isStatic: true },
]

function PaletteBlock({ type, label, icon, preview }) {
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
      }}
      className="flex flex-col gap-1.5 rounded-lg border border-[var(--border-base)] bg-[var(--bg-card)] p-3 hover:border-[var(--accent)] hover:bg-[var(--accent-glow)] transition-colors group"
    >
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-bold text-[var(--text-secondary)] group-hover:text-[var(--accent-light)] w-4 text-center leading-none">{icon}</span>
        <span className="text-[12.5px] font-medium text-[var(--text-primary)]">{label}</span>
      </div>
      <div className="text-[11px] text-[var(--text-tertiary)] truncate border border-dashed border-[var(--border-subtle)] rounded px-1.5 py-0.5 bg-[var(--bg-base)]">
        {preview}
      </div>
    </div>
  )
}

export default function FieldPalette() {
  return (
    <div className="flex flex-col gap-3 w-[200px] flex-shrink-0">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-0.5">
        Elements
      </div>
      <div className="grid grid-cols-1 gap-2">
        {PALETTE_TYPES.map(p => (
          <PaletteBlock key={p.type} {...p} />
        ))}
      </div>
      <p className="text-[11px] text-[var(--text-tertiary)] text-center mt-1">
        Drag to add
      </p>
    </div>
  )
}
