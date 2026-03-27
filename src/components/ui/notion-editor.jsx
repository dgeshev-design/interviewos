import { useEffect, useRef, useCallback } from 'react'
import EditorJS from '@editorjs/editorjs'
import Header from '@editorjs/header'
import List from '@editorjs/list'
import Quote from '@editorjs/quote'
import Code from '@editorjs/code'
import Checklist from '@editorjs/checklist'
import InlineCode from '@editorjs/inline-code'
import Marker from '@editorjs/marker'

function parseValue(value) {
  if (!value) return undefined
  try {
    const parsed = JSON.parse(value)
    if (parsed && parsed.blocks && Array.isArray(parsed.blocks)) return parsed
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
  const holderRef  = useRef(null)
  const editorRef  = useRef(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Forward text selection to parent (for "Add as quote")
  useEffect(() => {
    if (!onTextSelect) return
    const handleMouseUp = () => {
      const sel = window.getSelection()
      if (sel && sel.toString().trim() && holderRef.current?.contains(sel.anchorNode)) {
        onTextSelect(sel.toString().trim())
      }
    }
    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [onTextSelect])

  useEffect(() => {
    if (!holderRef.current) return

    const initialData = parseValue(value)

    const editor = new EditorJS({
      holder: holderRef.current,
      readOnly,
      placeholder,
      autofocus: false,
      data: initialData || { blocks: [] },
      tools: {
        header:     { class: Header,     inlineToolbar: true, config: { levels: [1,2,3], defaultLevel: 2 } },
        list:       { class: List,       inlineToolbar: true, config: { defaultStyle: 'unordered' } },
        quote:      { class: Quote,      inlineToolbar: true },
        code:       { class: Code },
        checklist:  { class: Checklist,  inlineToolbar: true },
        inlineCode: { class: InlineCode, shortcut: 'CMD+SHIFT+M' },
        marker:     { class: Marker,     shortcut: 'CMD+SHIFT+H' },
      },
      onChange: async () => {
        if (readOnly) return
        try {
          const data = await editor.save()
          onChangeRef.current?.(JSON.stringify(data))
        } catch {}
      },
    })

    editorRef.current = editor
    return () => {
      editor.isReady
        .then(() => { editor.destroy(); editorRef.current = null })
        .catch(() => {})
    }
  }, []) // intentionally run once — uncontrolled

  return (
    <div
      ref={holderRef}
      style={{
        width: '100%',
        minHeight: readOnly ? undefined : 200,
        fontSize: 14,
        lineHeight: 1.6,
        ...style,
      }}
    />
  )
}
