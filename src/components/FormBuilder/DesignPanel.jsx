const BG_PRESETS = [
  { label: 'Zinc',   value: '#f4f4f5' },
  { label: 'White',  value: '#ffffff' },
  { label: 'Slate',  value: '#f1f5f9' },
  { label: 'Stone',  value: '#f5f5f4' },
  { label: 'Indigo', value: '#eef2ff' },
  { label: 'Dark',   value: '#18181b' },
]

const CARD_PRESETS = [
  { label: 'White',  value: '#ffffff' },
  { label: 'Zinc',   value: '#fafafa' },
  { label: 'Slate',  value: '#f8fafc' },
  { label: 'Indigo', value: '#f5f3ff' },
  { label: 'Dark',   value: '#27272a' },
]

const ACCENT_PRESETS = [
  { label: 'Indigo', value: '#6366f1' },
  { label: 'Violet', value: '#8b5cf6' },
  { label: 'Blue',   value: '#3b82f6' },
  { label: 'Teal',   value: '#14b8a6' },
  { label: 'Rose',   value: '#f43f5e' },
  { label: 'Orange', value: '#f97316' },
]

function ColorSwatch({ value, selected, onChange, presets }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      {presets.map(p => (
        <button
          key={p.value}
          title={p.label}
          onClick={() => onChange(p.value)}
          style={{
            width: 26, height: 26, borderRadius: 6,
            background: p.value,
            border: selected === p.value ? '2px solid var(--accent)' : '2px solid var(--border-base)',
            cursor: 'pointer',
            boxShadow: selected === p.value ? '0 0 0 2px var(--accent-glow)' : 'none',
            transition: 'all 0.12s',
          }}
        />
      ))}
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        title="Custom color"
        style={{
          width: 26, height: 26, borderRadius: 6, padding: 2,
          border: '2px solid var(--border-base)', cursor: 'pointer',
          background: 'var(--bg-base)',
        }}
      />
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>{label}</div>
      {children}
    </div>
  )
}

function SegmentControl({ value, onChange, options }) {
  return (
    <div style={{ display: 'flex', gap: 2, background: 'var(--bg-raised)', borderRadius: 8, padding: 3, width: 'fit-content' }}>
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={{
            padding: '5px 12px', borderRadius: 6, fontSize: 12.5, fontWeight: 500,
            border: 'none', cursor: 'pointer', transition: 'all 0.12s',
            background: value === o.value ? 'var(--bg-card)' : 'transparent',
            color: value === o.value ? 'var(--text-primary)' : 'var(--text-tertiary)',
            boxShadow: value === o.value ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Toggle({ checked, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 36, height: 20, borderRadius: 10, border: 'none',
        background: checked ? 'var(--accent)' : 'var(--border-base)',
        cursor: 'pointer', position: 'relative', flexShrink: 0,
        transition: 'background 0.15s',
      }}
    >
      <div style={{
        width: 14, height: 14, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 3,
        left: checked ? 19 : 3,
        transition: 'left 0.15s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}

export default function DesignPanel({ style, onChange, onSave, saving }) {
  const set = (key, val) => onChange({ ...style, [key]: val })

  return (
    <div style={{ maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Background */}
      <Row label="Page background">
        <ColorSwatch value={style.bgColor} selected={style.bgColor} onChange={v => set('bgColor', v)} presets={BG_PRESETS} />
      </Row>

      {/* Card background */}
      <Row label="Form card background">
        <ColorSwatch value={style.cardBg} selected={style.cardBg} onChange={v => set('cardBg', v)} presets={CARD_PRESETS} />
      </Row>

      {/* Border style */}
      <Row label="Card border style">
        <SegmentControl
          value={style.borderStyle}
          onChange={v => set('borderStyle', v)}
          options={[
            { value: 'border',  label: 'Border' },
            { value: 'shadow',  label: 'Shadow' },
            { value: 'none',    label: 'None' },
          ]}
        />
      </Row>

      {/* Accent color */}
      <Row label="Accent color (button, required)">
        <ColorSwatch value={style.accentColor} selected={style.accentColor} onChange={v => set('accentColor', v)} presets={ACCENT_PRESETS} />
      </Row>

      {/* Spacing */}
      <Row label="Spacing">
        <SegmentControl
          value={style.spacing}
          onChange={v => set('spacing', v)}
          options={[
            { value: 'compact',  label: 'Compact' },
            { value: 'normal',   label: 'Normal' },
            { value: 'relaxed',  label: 'Relaxed' },
          ]}
        />
      </Row>

      {/* Logo */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>Logo</div>
          <Toggle checked={style.showLogo} onChange={v => set('showLogo', v)} />
        </div>
        {style.showLogo && (
          <input
            value={style.logoUrl || ''}
            onChange={e => set('logoUrl', e.target.value)}
            placeholder="https://yoursite.com/logo.png"
            style={{ background: 'var(--bg-base)', border: '1px solid var(--border-base)', borderRadius: 6, padding: '7px 10px', fontSize: 13, width: '100%', color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
          />
        )}
        {style.showLogo && !style.logoUrl && (
          <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', margin: 0 }}>Enter a public image URL for your logo</p>
        )}
      </div>

      {/* Header image */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>Header image</div>
          <Toggle checked={style.showHeaderImage} onChange={v => set('showHeaderImage', v)} />
        </div>
        {style.showHeaderImage && (
          <input
            value={style.headerImageUrl || ''}
            onChange={e => set('headerImageUrl', e.target.value)}
            placeholder="https://yoursite.com/banner.jpg"
            style={{ background: 'var(--bg-base)', border: '1px solid var(--border-base)', borderRadius: 6, padding: '7px 10px', fontSize: 13, width: '100%', color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
          />
        )}
      </div>

      {/* Button text */}
      <Row label="Submit button text">
        <input
          value={style.buttonText || ''}
          onChange={e => set('buttonText', e.target.value)}
          placeholder="Continue to booking →"
          style={{ background: 'var(--bg-base)', border: '1px solid var(--border-base)', borderRadius: 6, padding: '7px 10px', fontSize: 13, width: '100%', color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
        />
      </Row>

      {/* Save button */}
      <div>
        <button
          onClick={onSave}
          disabled={saving}
          style={{
            padding: '9px 20px', borderRadius: 8,
            background: 'var(--accent)', color: '#fff',
            border: 'none', fontSize: 13.5, fontWeight: 500,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.6 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          {saving ? 'Saving…' : 'Save design'}
        </button>
        <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 8 }}>
          Changes apply to your public form immediately after saving.
        </p>
      </div>
    </div>
  )
}
