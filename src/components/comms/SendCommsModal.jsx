import { useState, useEffect } from 'react'
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
  const { workspace, ownWorkspace } = useApp()
  const { toast } = useToast()
  const [selectedId, setSelectedId] = useState('')
  const [sending, setSending] = useState(false)
  const [commsSettings, setCommsSettings] = useState(null)

  useEffect(() => {
    const wsId = ownWorkspace?.id || workspace?.id
    if (!wsId) return
    supabase.from('workspace_settings').select('*').eq('workspace_id', wsId).maybeSingle()
      .then(({ data }) => setCommsSettings(data || null))
  }, [ownWorkspace?.id, workspace?.id])

  const selected = templates.find(t => t.id === selectedId)
  const preview  = selected ? applyTemplateVars(selected.body, participant, study) : ''

  const handleSend = async () => {
    if (!selected || !participant) return
    setSending(true)
    try {
      const body    = applyTemplateVars(selected.body, participant, study)
      const subject = applyTemplateVars(selected.subject || '', participant, study)

      let result
      if      (selected.channel === 'email')    result = await sendEmail({ to: participant.email, subject, body, isHtml: selected.is_html, workspace_id: workspace.id, comms_settings: commsSettings })
      else if (selected.channel === 'whatsapp') result = await sendWhatsApp({ to: normalisePhone(participant.phone), body, workspace_id: workspace.id, comms_settings: commsSettings })
      else if (selected.channel === 'sms')      result = await sendSMS({ to: normalisePhone(participant.phone), body, workspace_id: workspace.id, comms_settings: commsSettings })

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
      <DialogContent className="max-w-xl">
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
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Preview</p>
              {selected.channel === 'sms' && (
                <div className={`flex items-center justify-between text-xs ${selected.body.length > 160 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  <span>{selected.body.length > 160 ? `⚠ Exceeds 160 chars — ${Math.ceil(selected.body.length / 160)} messages` : `${selected.body.length} / 160 chars`}</span>
                </div>
              )}
              <div className="rounded-lg border bg-muted/20 overflow-hidden" style={{ minHeight: 120, maxHeight: 400, overflowY: 'auto' }}>
                {selected.channel === 'email' ? (
                  <div className="flex flex-col h-full">
                    {selected.subject && (
                      <div className="px-4 py-2 border-b bg-muted/40 text-xs shrink-0">
                        <span className="text-muted-foreground">Subject: </span>
                        <span className="font-medium">{applyTemplateVars(selected.subject, participant, study)}</span>
                      </div>
                    )}
                    {selected.is_html ? (
                      <iframe
                        srcDoc={preview || '<p style="color:#9ca3af;font-size:13px;padding:16px">No content</p>'}
                        className="w-full border-0"
                        style={{ height: 360, display: 'block' }}
                        sandbox="allow-same-origin"
                        title="Email preview"
                      />
                    ) : (
                      <div className="p-4">
                        <p className="text-sm whitespace-pre-wrap text-foreground leading-relaxed">{preview}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 flex flex-col gap-2 items-start">
                    {selected.channel === 'sms' && preview ? (
                      preview.match(/.{1,160}/gs)?.map((chunk, i) => (
                        <div key={i} className="max-w-[85%] bg-white border rounded-2xl rounded-tl-sm px-3 py-2 shadow-sm">
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{chunk}</p>
                          <p className="text-[10px] text-muted-foreground mt-1 text-right">SMS {i + 1}</p>
                        </div>
                      ))
                    ) : (
                      <div className="max-w-[85%] bg-white border rounded-2xl rounded-tl-sm px-3 py-2 shadow-sm">
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{preview}</p>
                      </div>
                    )}
                  </div>
                )}
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
