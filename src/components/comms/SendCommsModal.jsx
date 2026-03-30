import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { sendEmail, sendWhatsApp, sendSMS } from '@/lib/api'
import { applyTemplateVars, TRIGGER_LABELS } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useApp } from '@/context/AppContext'
import { useToast } from '@/hooks/use-toast'

const CHANNEL_COLORS = { email: 'blue', whatsapp: 'success', sms: 'secondary' }

const normalisePhone = (raw) => {
  if (!raw) return ''
  if (raw.includes('|')) {
    const [code, num] = raw.split('|')
    return `${code}${num.replace(/\D/g, '')}`
  }
  return raw
}

export default function SendCommsModal({ open, onClose, participant, templates, study, onSent }) {
  const { workspace } = useApp()
  const { toast } = useToast()
  const [selectedId, setSelectedId] = useState('')
  const [sending, setSending] = useState(false)

  const selected = templates.find(t => t.id === selectedId)
  const preview  = selected ? applyTemplateVars(selected.body, participant, study) : ''

  const handleSend = async () => {
    if (!selected || !participant) return
    setSending(true)
    try {
      const body    = applyTemplateVars(selected.body, participant, study)
      const subject = applyTemplateVars(selected.subject || '', participant, study)

      let result
      if      (selected.channel === 'email')    result = await sendEmail({ to: participant.email, subject, body, isHtml: selected.is_html, workspace_id: workspace.id })
      else if (selected.channel === 'whatsapp') result = await sendWhatsApp({ to: normalisePhone(participant.phone), body, workspace_id: workspace.id })
      else if (selected.channel === 'sms')      result = await sendSMS({ to: normalisePhone(participant.phone), body, workspace_id: workspace.id })

      const status = result?.error ? 'failed' : 'sent'

      await supabase.from('send_log').insert({
        workspace_id:   workspace.id,
        participant_id: participant.id,
        template_id:    selected.id,
        channel:        selected.channel,
        subject:        subject || null,
        body_preview:   body.slice(0, 200),
        status,
        error:          result?.error || null,
      })

      toast({ title: status === 'sent' ? 'Message sent' : 'Send failed', variant: status === 'sent' ? 'success' : 'destructive', description: status === 'sent' ? `${selected.channel} sent to ${participant.name}` : result?.error })
      if (status === 'sent') { onSent?.(); onClose() }
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
    setSending(false)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send message to {participant?.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Template</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a template…" />
              </SelectTrigger>
              <SelectContent>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    <div className="flex items-center gap-2">
                      <Badge variant={CHANNEL_COLORS[t.channel]} className="text-[10px] px-1.5 py-0">{t.channel}</Badge>
                      <span>{t.name}</span>
                      <span className="text-muted-foreground text-xs">{TRIGGER_LABELS[t.trigger_type]}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selected && (
            <div className="space-y-2">
              {selected.subject && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Subject:</span> {applyTemplateVars(selected.subject, participant, study)}
                </div>
              )}
              <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                {preview}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSend} disabled={!selectedId || sending}>
            {sending ? 'Sending…' : 'Send now'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
