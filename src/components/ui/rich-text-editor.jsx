import { useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { Bold, Italic, List, ListOrdered, Quote, Heading2 } from 'lucide-react'

export default function RichTextEditor({ value, onChange, placeholder = 'Start typing…', className, onTextSelect }) {
  const editorRef = useRef(null)
  const isComposing = useRef(false)

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || ''
    }
  }, [])

  const exec = (cmd, val = null) => {
    editorRef.current?.focus()
    document.execCommand(cmd, false, val)
    handleInput()
  }

  const handleInput = () => {
    if (!isComposing.current && onChange) {
      onChange(editorRef.current?.innerHTML || '')
    }
  }

  const handleMouseUp = () => {
    const sel = window.getSelection()
    if (sel && sel.toString().trim() && onTextSelect) {
      onTextSelect(sel.toString().trim())
    }
  }

  const tools = [
    { icon: Bold,         cmd: 'bold',         title: 'Bold'         },
    { icon: Italic,       cmd: 'italic',        title: 'Italic'       },
    { icon: Heading2,     cmd: 'formatBlock',   val: 'h2', title: 'Heading' },
    { icon: List,         cmd: 'insertUnorderedList',   title: 'Bullet list'  },
    { icon: ListOrdered,  cmd: 'insertOrderedList',     title: 'Numbered list'},
    { icon: Quote,        cmd: 'formatBlock',   val: 'blockquote', title: 'Quote' },
  ]

  return (
    <div className={cn('border rounded-md overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 p-1.5 border-b bg-gray-50/50">
        {tools.map(({ icon: Icon, cmd, val, title }) => (
          <button
            key={title}
            type="button"
            title={title}
            onMouseDown={(e) => { e.preventDefault(); exec(cmd, val) }}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onMouseUp={handleMouseUp}
        onCompositionStart={() => { isComposing.current = true }}
        onCompositionEnd={() => { isComposing.current = false; handleInput() }}
        data-placeholder={placeholder}
        className={cn(
          'min-h-[160px] px-3 py-2.5 text-sm outline-none rich-text-content',
          'empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground'
        )}
      />
    </div>
  )
}
