import { useState, useEffect } from 'react'
import { useApp } from '@/context/AppContext'
import { useTemplates } from '@/hooks/useTemplates'
import { supabase } from '@/lib/supabase'
import { saveGoogleToken, sendEmail, sendWhatsApp, sendSMS } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import TemplateModal from '@/components/comms/TemplateModal'
import { TRIGGER_LABELS, applyTemplateVars } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import { useToast } from '@/hooks/use-toast'
import { Plus, Trash2, Check, Calendar, AlertCircle, Send } from 'lucide-react'

const CHANNEL_COLORS = { email: 'blue', whatsapp: 'success', sms: 'secondary' }

export default function Settings() {
  const { workspace, user, signInWithGoogle } = useApp()
  const { templates, loading: tLoading, add, update, remove } = useTemplates()
  const { toast } = useToast()

  const [showTemplate, setShowTemplate]     = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [wsName, setWsName]                 = useState(workspace?.name || '')
  const [savingWs, setSavingWs]             = useState(false)
  const [gcalStatus, setGcalStatus]         = useState(null) // null | 'connected' | 'missing'
  const [gcalEmail, setGcalEmail]           = useState('')
  const [connectingCal, setConnectingCal]   = useState(false)

  // Send-test state
  const [testTemplate, setTestTemplate]     = useState(null) // template being tested
  const [participants, setParticipants]     = useState([])
  const [participantSearch, setParticipantSearch] = useState('')
  const [testParticipant, setTestParticipant] = useState(null)
  const [sending, setSending]               = useState(false)

  // Check if Google Calendar token exists; also save token if returning from OAuth redirect
  useEffect(() => {
    if (!workspace) return
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      // If we just came back from Google OAuth and have a provider_token, save it
      if (session?.provider_token) {
        try {
          await saveGoogleToken({
            workspaceId:  workspace.id,
            accessToken:  session.provider_token,
            refreshToken: session.provider_refresh_token || null,
            expiresIn:    3600,
            email:        session.user?.email || '',
          })
        } catch {}
      }
      // Now check gcal status
      const { data } = await supabase
        .from('google_tokens')
        .select('email, updated_at')
        .eq('workspace_id', workspace.id)
        .single()
      if (data) { setGcalStatus('connected'); setGcalEmail(data.email || '') }
      else setGcalStatus('missing')
    })
  }, [workspace])

  const saveWorkspace = async () => {
    setSavingWs(true)
    const { error } = await supabase.from('workspaces').update({ name: wsName }).eq('id', workspace.id)
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' })
    else toast({ title: 'Saved', variant: 'success' })
    setSavingWs(false)
  }

  const handleConnectGoogle = async () => {
    setConnectingCal(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/settings`,
        scopes: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar',
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    if (error) {
      toast({ title: 'Connection failed', description: error.message, variant: 'destructive' })
      setConnectingCal(false)
    }
    // On success the browser redirects away — setConnectingCal(false) won't be reached
  }

  const handleDisconnectGoogle = async () => {
    if (!confirm('Disconnect Google Calendar? Sync will stop working.')) return
    await supabase.from('google_tokens').delete().eq('workspace_id', workspace.id)
    setGcalStatus('missing')
    setGcalEmail('')
    toast({ title: 'Disconnected', variant: 'success' })
  }

  const openTestSend = async (t) => {
    setTestTemplate(t)
    setTestParticipant(null)
    setParticipantSearch('')
    if (!participants.length) {
      const { data } = await supabase.from('participants').select('id,name,email,phone').eq('workspace_id', workspace.id).order('name').limit(200)
      setParticipants(data || [])
    }
  }

  // Normalise phone: handles "CODE|NUMBER" storage format → "+15551234567"
  const normalisePhone = (raw) => {
    if (!raw) return ''
    if (raw.includes('|')) {
      const [code, num] = raw.split('|')
      return `${code}${num.replace(/\D/g, '')}`
    }
    return raw
  }

  const handleTestSend = async () => {
    if (!testTemplate || !testParticipant) return
    const needsPhone = testTemplate.channel === 'whatsapp' || testTemplate.channel === 'sms'
    const phone = normalisePhone(testParticipant.phone)
    if (needsPhone && !phone) {
      toast({ title: 'No phone number', description: `${testParticipant.name} has no phone number saved.`, variant: 'destructive' })
      return
    }
    setSending(true)
    try {
      const body = applyTemplateVars(testTemplate.body, testParticipant, null)
      const subject = applyTemplateVars(testTemplate.subject || '', testParticipant, null)
      let result
      if      (testTemplate.channel === 'email')    result = await sendEmail({ to: testParticipant.email, subject, body, isHtml: testTemplate.is_html })
      else if (testTemplate.channel === 'whatsapp') result = await sendWhatsApp({ to: phone, body })
      else if (testTemplate.channel === 'sms')      result = await sendSMS({ to: phone, body })
      if (result?.error) throw new Error(result.error)
      toast({ title: 'Test sent', description: `${testTemplate.channel} sent to ${testParticipant.name}`, variant: 'success' })
      setTestTemplate(null)
    } catch (e) {
      toast({ title: 'Send failed', description: e.message, variant: 'destructive' })
    }
    setSending(false)
  }

  const handleSaveTemplate = async (form) => {
    if (editingTemplate?.id) await update(editingTemplate.id, form)
    else await add(form)
    setEditingTemplate(null)
  }

  return (
    <div className="p-8">
      <PageHeader title="Settings" description="Manage your workspace, integrations and message templates" />

      {/* Workspace */}
      <Card className="shadow-none mb-5">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Workspace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Workspace name</Label>
            <div className="flex gap-2">
              <Input value={wsName} onChange={e => setWsName(e.target.value)} className="max-w-xs" />
              <Button size="sm" onClick={saveWorkspace} disabled={savingWs}>
                {savingWs ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Google Calendar integration */}
      <Card className="shadow-none mb-5">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Google Calendar
          </CardTitle>
          <CardDescription>
            Connect to sync your Google Calendar. Busy blocks will show in the calendar view and new bookings will create Meet links automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {gcalStatus === null && <p className="text-sm text-muted-foreground">Checking…</p>}

          {gcalStatus === 'connected' && (
            <div className="flex items-center justify-between p-4 rounded-lg bg-green-50 border border-green-200">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-white border border-green-200 flex items-center justify-center">
                  <Check className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <div className="text-sm font-medium text-green-800">Connected</div>
                  {gcalEmail && <div className="text-xs text-green-600">{gcalEmail}</div>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleConnectGoogle}>
                  Reconnect
                </Button>
                <Button variant="ghost" size="sm" className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-50" onClick={handleDisconnectGoogle}>
                  Disconnect
                </Button>
              </div>
            </div>
          )}

          {gcalStatus === 'missing' && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-sm text-amber-800">
                  Google Calendar is not connected. Connect it to automatically create Meet links on booking and see your busy times.
                </div>
              </div>
              <Button onClick={handleConnectGoogle} disabled={connectingCal} className="gap-2">
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {connectingCal ? 'Connecting…' : 'Connect Google Calendar'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comms templates */}
      <Card className="shadow-none">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">Message templates</CardTitle>
              <CardDescription className="mt-0.5">Sent automatically at trigger time, or manually from a participant profile.</CardDescription>
            </div>
            <Button size="sm" onClick={() => { setEditingTemplate(null); setShowTemplate(true) }}>
              <Plus className="h-4 w-4 mr-1.5" /> New template
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
           templates.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-3">No templates yet.</p>
              <Button size="sm" onClick={() => setShowTemplate(true)}><Plus className="h-4 w-4 mr-1.5" />Create first template</Button>
            </div>
           ) : (
            <div className="space-y-2">
              {templates.map(t => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <Badge variant={CHANNEL_COLORS[t.channel]} className="text-[10px] shrink-0">{t.channel}</Badge>
                    <div>
                      <div className="text-sm font-medium">{t.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {TRIGGER_LABELS[t.trigger_type]}
                        {t.trigger_offset !== 0 && ` · ${Math.abs(t.trigger_offset)} min ${t.trigger_offset < 0 ? 'before' : 'after'}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => openTestSend(t)}>
                      <Send className="h-3 w-3" /> Test
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setEditingTemplate(t); setShowTemplate(true) }}>Edit</Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => { if (confirm('Delete?')) remove(t.id) }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
           )}
        </CardContent>
      </Card>

      {showTemplate && (
        <TemplateModal
          open={showTemplate}
          onClose={() => { setShowTemplate(false); setEditingTemplate(null) }}
          onSave={handleSaveTemplate}
          initial={editingTemplate}
        />
      )}

      {/* Send test dialog */}
      <Dialog open={!!testTemplate} onOpenChange={v => { if (!v) setTestTemplate(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send test — {testTemplate?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Search participant</Label>
              <Input
                placeholder="Name or email…"
                value={participantSearch}
                onChange={e => { setParticipantSearch(e.target.value); setTestParticipant(null) }}
              />
              {participantSearch.length > 1 && (
                <div className="border rounded-md max-h-40 overflow-y-auto divide-y">
                  {participants
                    .filter(p => p.name?.toLowerCase().includes(participantSearch.toLowerCase()) || p.email?.toLowerCase().includes(participantSearch.toLowerCase()))
                    .slice(0, 8)
                    .map(p => (
                      <button key={p.id} className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/40 transition-colors ${testParticipant?.id === p.id ? 'bg-muted/60' : ''}`}
                        onClick={() => { setTestParticipant(p); setParticipantSearch(p.name) }}>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.email || p.phone}</div>
                      </button>
                    ))}
                </div>
              )}
              {testParticipant && (() => {
                const isEmail   = testTemplate?.channel === 'email'
                const dest      = isEmail ? testParticipant.email : normalisePhone(testParticipant.phone)
                const missing   = !dest
                return missing
                  ? <p className="text-xs text-red-500">⚠ {testParticipant.name} has no {isEmail ? 'email' : 'phone number'} saved.</p>
                  : <p className="text-xs text-green-600">Sending to: {testParticipant.name} ({dest})</p>
              })()}
            </div>
            {testTemplate && testParticipant && (
              <div className="rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap max-h-32 overflow-y-auto text-muted-foreground">
                {applyTemplateVars(testTemplate.body, testParticipant, null)}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestTemplate(null)}>Cancel</Button>
            <Button onClick={handleTestSend} disabled={!testParticipant || sending}>
              {sending ? 'Sending…' : `Send via ${testTemplate?.channel}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
