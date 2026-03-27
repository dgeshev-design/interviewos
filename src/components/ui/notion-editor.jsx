import { useMemo, useRef, useEffect } from 'react'
import YooptaEditor, { createYooptaEditor } from '@yoopta/editor'
import Paragraph from '@yoopta/paragraph'
import { HeadingOne, HeadingTwo, HeadingThree } from '@yoopta/headings'
import { BulletedList, NumberedList, TodoList } from '@yoopta/lists'
import Blockquote from '@yoopta/blockquote'
import Code from '@yoopta/code'
import Link from '@yoopta/link'
import { Bold, Italic, CodeMark, Underline, Strike, Highlight } from '@yoopta/marks'
import Toolbar, { DefaultToolbarRender } from '@yoopta/toolbar'
import ActionMenuList, { DefaultActionMenuRender } from '@yoopta/action-menu-list'

const PLUGINS = [
  Paragraph,
  HeadingOne,
  HeadingTwo,
  HeadingThree,
  BulletedList,
  NumberedList,
  TodoList,
  Blockquote,
  Code,
  Link,
]

const MARKS = [Bold, Italic, CodeMark, Underline, Strike, Highlight]

const EDITING_TOOLS = {
  Toolbar:    { tool: Toolbar,        render: DefaultToolbarRender    },
  ActionMenu: { tool: ActionMenuList, render: DefaultActionMenuRender },
}

function parseValue(value) {
  if (!value) return undefined
  try {
    const parsed = JSON.parse(value)
    // Must be an object with block keys (Yoopta format)
    if (typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
  } catch {}
  return undefined
}

export default function NotionEditor({
  value,
  onChange,
  placeholder = 'Start typing… Type / for commands',
  onTextSelect,
  readOnly = false,
  style,
}) {
  const editor      = useMemo(() => createYooptaEditor(), [])
  const initialValue = useMemo(() => parseValue(value), [])  // only parsed once (uncontrolled)
  const containerRef = useRef(null)

  // Forward text selection to parent (for "Add as quote")
  useEffect(() => {
    if (!onTextSelect) return
    const handleMouseUp = () => {
      const sel = window.getSelection()
      if (sel && sel.toString().trim() && containerRef.current?.contains(sel.anchorNode)) {
        onTextSelect(sel.toString().trim())
      }
    }
    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [onTextSelect])

  return (
    <div ref={containerRef} style={{ width: '100%', ...style }}>
      <YooptaEditor
        editor={editor}
        plugins={PLUGINS}
        tools={readOnly ? {} : EDITING_TOOLS}
        marks={MARKS}
        value={initialValue}
        onChange={(val) => onChange?.(JSON.stringify(val))}
        placeholder={placeholder}
        readOnly={readOnly}
        style={{ width: '100%', minHeight: readOnly ? undefined : 320, fontFamily: 'inherit' }}
        autoFocus={false}
      />
    </div>
  )
}
