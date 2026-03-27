import { useState, useRef } from 'react'
import { cn, TEMPLATE_VARS } from '@/lib/utils'
import { Button } from './button'
import { Switch } from './switch'
import { Label } from './label'

export default function HtmlEditor({ value, onChange, isHtml, onToggleHtml, placeholder }) {
  const [showVarMenu, setShowVarMenu] = useState(false)
  const [varFilter, setVarFilter]     = useState('')
  const textareaRef = useRef(null)

  const insertVar = (varKey) => {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end   = el.selectionEnd
    const newVal = value.slice(0, start) + varKey + value.slice(end)
    onChange(newVal)
    setShowVarMenu(false)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + varKey.length, start + varKey.length)
    }, 0)
  }

  const handleKeyDown = (e) => {
    if (e.key === '{' && value[textareaRef.current?.selectionStart - 1] === '{') {
      setShowVarMenu(true)
      setVarFilter('')
    }
    if (e.key === 'Escape') setShowVarMenu(false)
  }

  const filtered = TEMPLATE_VARS.filter(v =>
    v.key.toLowerCase().includes(varFilter.toLowerCase()) ||
    v.label.toLowerCase().includes(varFilter.toLowerCase())
  )

  return (
    <div className="space-y-2">
      {/* Toolbar: HTML toggle + var chips */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted-foreground mr-1">Insert:</span>
          {TEMPLATE_VARS.map(v => (
            <button
              key={v.key}
              type="button"
              onClick={() => insertVar(v.key)}
              className="inline-flex items-center px-2 py-0.5 rounded-full bg-brand-50 text-brand-600 text-xs font-mono hover:bg-brand-100 transition-colors border border-brand-200"
            >
              {v.key}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <Label htmlFor="html-toggle" className="text-xs text-muted-foreground">HTML</Label>
          <Switch id="html-toggle" checked={isHtml} onCheckedChange={onToggleHtml} />
        </div>
      </div>

      {/* Editor */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || (isHtml ? '<p>Hello {{name}},</p>' : 'Hi {{name}}, your session is on {{date}} at {{time}}.')}
          rows={8}
          className={cn(
            'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm resize-y',
            'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            isHtml && 'font-mono text-xs'
          )}
        />

        {/* Variable autocomplete dropdown */}
        {showVarMenu && (
          <div className="absolute z-50 bottom-full mb-1 left-0 w-64 rounded-md border bg-popover shadow-md p-1">
            <input
              autoFocus
              value={varFilter}
              onChange={e => setVarFilter(e.target.value)}
              placeholder="Filter variables…"
              className="w-full px-2 py-1 text-xs border-b mb-1 outline-none bg-transparent"
            />
            {filtered.map(v => (
              <button
                key={v.key}
                type="button"
                onClick={() => insertVar(v.key)}
                className="w-full flex items-center justify-between px-2 py-1.5 text-xs rounded hover:bg-muted text-left"
              >
                <span className="font-mono text-brand-600">{v.key}</span>
                <span className="text-muted-foreground">{v.label}</span>
              </button>
            ))}
            {filtered.length === 0 && <div className="px-2 py-2 text-xs text-muted-foreground">No variables found</div>}
          </div>
        )}
      </div>

      {isHtml && (
        <p className="text-xs text-muted-foreground">HTML mode — use full HTML tags. Type <code className="bg-muted px-1 rounded">{'{{{'}</code> or click a chip above to insert a variable.</p>
      )}
    </div>
  )
}
