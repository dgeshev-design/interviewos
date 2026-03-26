import StatusBadge from './StatusBadge'
import Icon from './Icon'
import styles from './QuestionCard.module.css'

export default function QuestionCard({ question, note, isDone, isActive, onNoteChange, onToggleDone, onAISuggest, onFocus }) {
  return (
    <div
      className={`${styles.card} ${isDone ? styles.done : ''} ${isActive ? styles.active : ''}`}
      onClick={onFocus}
    >
      <div className={styles.header}>
        <StatusBadge status={question.level} />
        <p className={styles.text}>{question.body}</p>
        <button
          className={`btn btn-sm ${isDone ? styles.doneBtn : 'btn-ghost'}`}
          style={{ marginLeft: 'auto', flexShrink: 0 }}
          onClick={e => { e.stopPropagation(); onToggleDone() }}
        >
          {isDone ? <><Icon name="check" size={12} /> Done</> : 'Mark done'}
        </button>
      </div>

      <textarea
        className={styles.notes}
        placeholder="Notes for this question…"
        value={note || ''}
        onChange={e => onNoteChange(e.target.value)}
        onClick={e => e.stopPropagation()}
      />

      <button
        className={`btn btn-ghost btn-sm ${styles.aiBtn}`}
        onClick={e => { e.stopPropagation(); onAISuggest() }}
      >
        <Icon name="sparkle" size={12} color="var(--accent-light)" />
        AI follow-ups
      </button>
    </div>
  )
}
