import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import HtmlEditor from '@/components/ui/html-editor'
import { TRIGGER_LABELS } from '@/lib/utils'

const CHANNELS = ['email', 'whatsapp', 'sms']
const TRIGGERS = Object.entries(TRIGGER_LABELS)

export default function TemplateModal({ open, onClose, onSave, initial }) {
  const [form, setForm] = useState(initial || {
    name: '', trigger_type: 'booking_confirmed', channel: 'email',
    subject: '', body: '', is_html: false, is_active: true, trigger_offset: 0
  })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name || !form.body) return
    setSaving(true)
    try { await onSave(form); onClose() }
    catch (e) { alert(e.message) }
    setSaving(false)
  }

  const triggerOffsetLabel = () => {
    const m = Number(form.trigger_offset)
    if (m === 0) return 'At time of booking'
    if (m < 0)  return `${Math.abs(m)} min before session`
    return `${m} min after session`
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial?.id ? 'Edit template' : 'New template'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Template name</Label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Booking confirmation" />
            </div>
            <div className="space-y-1.5">
              <Label>Channel</Label>
              <Select value={form.channel} onValueChange={v => set('channel', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANNELS.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Trigger</Label>
              <Select value={form.trigger_type} onValueChange={v => set('trigger_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRIGGERS.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Send timing</Label>
              <div className="space-y-1">
                <Input
                  type="number"
                  value={form.trigger_offset}
                  onChange={e => set('trigger_offset', Number(e.target.value))}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">{triggerOffsetLabel()}</p>
              </div>
            </div>
          </div>

          {form.channel === 'email' && (
            <div className="space-y-1.5">
              <Label>Subject line</Label>
              <Input value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Your interview is confirmed!" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Message body</Label>
            <HtmlEditor
              value={form.body}
              onChange={v => set('body', v)}
              isHtml={form.is_html}
              onToggleHtml={v => set('is_html', v)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.name || !form.body}>
            {saving ? 'Saving…' : 'Save template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
