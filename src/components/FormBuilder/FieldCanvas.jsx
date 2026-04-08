import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import CanvasField from './CanvasField'

export default function FieldCanvas({ fields, onUpdate, onRemove, onChangeType, activeId }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'canvas' })

  const isEmpty = fields.length === 0

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        ref={setNodeRef}
        style={{
          minHeight: 400,
          borderRadius: 12,
          border: isOver
            ? '2px dashed var(--accent)'
            : '2px dashed var(--border-base)',
          background: isOver ? 'var(--accent-glow)' : 'var(--bg-raised)',
          padding: isEmpty ? 0 : '16px',
          transition: 'border-color 0.15s, background 0.15s',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {isEmpty ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            color: isOver ? 'var(--accent-light)' : 'var(--text-tertiary)',
            gap: 8, padding: 48, transition: 'color 0.15s',
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
              <rect x="3" y="3" width="18" height="18" rx="3"/>
              <path d="M12 8v8M8 12h8"/>
            </svg>
            <div style={{ fontSize: 13.5, fontWeight: 500 }}>Drop elements here</div>
            <div style={{ fontSize: 12, opacity: 0.7, textAlign: 'center', maxWidth: 200 }}>
              Drag any element from the left panel to build your form
            </div>
          </div>
        ) : (
          <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {fields.map(field => (
                <CanvasField
                  key={field.id}
                  field={field}
                  onUpdate={onUpdate}
                  onRemove={onRemove}
                  onChangeType={onChangeType}
                />
              ))}
            </div>

            {/* Drop zone at bottom */}
            <div style={{
              marginTop: 8,
              borderRadius: 8,
              border: isOver ? '2px dashed var(--accent)' : '2px dashed transparent',
              padding: '10px 16px',
              textAlign: 'center',
              fontSize: 12,
              color: isOver ? 'var(--accent-light)' : 'var(--text-tertiary)',
              transition: 'all 0.15s',
              background: isOver ? 'var(--accent-glow)' : 'transparent',
            }}>
              {isOver ? '↓ Drop here' : '+ Drag more elements'}
            </div>
          </SortableContext>
        )}
      </div>
    </div>
  )
}
