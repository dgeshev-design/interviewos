import { useState, useRef, useEffect } from 'react'
import { PHONE_CODES, PHONE_BY_ISO } from '@/lib/phoneCodes'
import { ChevronDown, Search } from 'lucide-react'

/**
 * Searchable country picker for phone inputs.
 * value: ISO code (e.g. "GB")
 * onChange(iso): called with new ISO code
 */
export default function PhoneCountryPicker({ value = 'GB', onChange }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef(null)
  const searchRef = useRef(null)

  const current = PHONE_BY_ISO[value] || PHONE_CODES[0]

  const filtered = query.trim()
    ? PHONE_CODES.filter(c =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.dialCode.includes(query) ||
        c.iso.toLowerCase().includes(query.toLowerCase())
      )
    : PHONE_CODES

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50)
  }, [open])

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setQuery('') }}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '9px 10px', borderRadius: '6px 0 0 6px',
          border: '1px solid #d1d5db', borderRight: 'none',
          background: '#f9fafb', cursor: 'pointer', fontSize: 13,
          whiteSpace: 'nowrap', minWidth: 90, lineHeight: '1.2',
        }}
      >
        <span style={{ fontSize: 16 }}>{current.flag}</span>
        <span style={{ color: '#374151', fontWeight: 500 }}>{current.dialCode}</span>
        <ChevronDown size={12} style={{ color: '#9ca3af', marginLeft: 2 }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 999,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', width: 280, marginTop: 4,
          overflow: 'hidden',
        }}>
          {/* Search */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Search size={13} style={{ color: '#9ca3af', flexShrink: 0 }} />
            <input
              ref={searchRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search country or code…"
              style={{
                border: 'none', outline: 'none', fontSize: 13,
                background: 'transparent', width: '100%', color: '#111827',
              }}
            />
          </div>

          {/* List */}
          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {filtered.length === 0 && (
              <div style={{ padding: '10px 14px', fontSize: 13, color: '#9ca3af' }}>No results</div>
            )}
            {filtered.map(c => (
              <button
                key={c.iso}
                type="button"
                onClick={() => { onChange(c.iso); setOpen(false); setQuery('') }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '7px 12px', border: 'none',
                  background: c.iso === value ? '#f5f3ff' : 'transparent',
                  cursor: 'pointer', textAlign: 'left', fontSize: 13,
                }}
                onMouseEnter={e => { if (c.iso !== value) e.currentTarget.style.background = '#f9fafb' }}
                onMouseLeave={e => { if (c.iso !== value) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ fontSize: 15, flexShrink: 0 }}>{c.flag}</span>
                <span style={{ flex: 1, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                <span style={{ color: '#9ca3af', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{c.dialCode}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
