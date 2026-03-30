import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useParticipants } from '@/hooks/useParticipants'
import { useParticipantFiles } from '@/hooks/useParticipantFiles'
import { useSendLog } from '@/hooks/useSendLog'
import { useTemplates } from '@/hooks/useTemplates'
import { useStudies } from '@/hooks/useStudies'
import { useApp } from '@/context/AppContext'
import { sendEmail, sendWhatsApp, cancelCalEvent } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { applyTemplateVars, formatDateTime, formatDate, TRIGGER_LABELS, cn } from '@/lib/utils'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import StatusBadge from '@/components/ui/status-badge'
import NotionEditor from '@/components/ui/notion-editor'
import SendCommsModal from '@/components/comms/SendCommsModal'
import { useToast } from '@/hooks/use-toast'
import {
  ArrowLeft, Star, Tag, Plus, X, Upload, FileText, Image, Video,
  File, Trash2, Send, Gift, Mail, MessageCircle, ExternalLink, Quote, Check, XCircle
} from 'lucide-react'

const FILE_ICONS = { video: Video, image: Image, document: FileText, transcript: File }
const CHANNEL_ICONS = { email: Mail, whatsapp: MessageCircle, sms: MessageCircle }

export default function ParticipantProfile() {
  const { studyId, participantId } = useParams()
  const navigate  = useNavigate()
  const { workspace } = useApp()
  const { toast } = useToast()

  const { participants, update } = useParticipants(studyId)
  const { files, loading: fLoading, upload, getUrl, remove: removeFile } = useParticipantFiles(participantId)
  const { logs, refetch: refetchLogs } = useSendLog(participantId)
  const { templates } = useTemplates()
  const { studies } = useStudies()

  const participant = participants.find(p => p.id === participantId)
  const study       = studies.find(s => s.id === studyId)

  const [editing, setEditing]         = useState(false)
  const [form, setForm]               = useState(null)
  const [formFields, setFormFields]   = useState([])
  const [tagInput, setTagInput]       = useState('')
  const [newQuote, setNewQuote]       = useState('')
  const [selectedText, setSelectedText] = useState('')
  const [uploading, setUploading]     = useState(false)
  const [showSend, setShowSend]       = useState(false)
  const [prizeCode, setPrizeCode]     = useState('')
  const [sendingPrize, setSendingPrize] = useState(false)
  const [fileUrls, setFileUrls]       = useState({})
  const [cancelling, setCancelling]   = useState(false)

  useEffect(() => {
    if (participant && !form) setForm({ ...participant })
  }, [participant])

  useEffect(() => {
    if (!study?.id) return
    supabase.from('forms').select('fields').eq('study_id', study.id).eq('is_active', true).maybeSingle()
      .then(({ data }) => { if (data?.fields) setFormFields(data.fields) })
  }, [study?.id])

  useEffect(() => {
    // Load signed URLs for files
    files.forEach(async f => {
      if (!fileUrls[f.id]) {
        const url = await getUrl(f.storage_path)
        setFileUrls(prev => ({ ...prev, [f.id]: url }))
      }
    })
  }, [files])

  const save = async () => {
    try { await update(participantId, form); setEditing(false); toast({ title: 'Saved', variant: 'success' }) }
    catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }) }
  }

  // Auto-save notes & quotes with debounce
  const autoSaveTimer = useRef(null)
  const autoSave = (patch) => {
    clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      update(participantId, patch).catch(() => {})
    }, 800)
  }

  const handleCancel = async () => {
    if (!confirm('Cancel this booking? The Google Calendar event will be deleted and the slot freed up.')) return
    setCancelling(true)
    try {
      // Find the slot booked by this participant
      const { data: slotRows } = await supabase
        .from('slots')
        .select('id, gcal_event_id, user_id')
        .eq('participant_id', participantId)
        .maybeSingle()

      // Remove the booked slot (dynamic model — available slots are computed, not stored)
      if (slotRows) {
        await supabase.from('slots').delete().eq('id', slotRows.id)
        if (slotRows.gcal_event_id) {
          await cancelCalEvent({ workspaceId: workspace.id, userId: slotRows.user_id, eventId: slotRows.gcal_event_id })
        }
      }

      // Mark participant cancelled
      await update(participantId, { status: 'cancelled' })
      setForm(f => ({ ...f, status: 'cancelled' }))
      toast({ title: 'Booking cancelled', description: 'Slot freed and calendar event removed.', variant: 'success' })
    } catch (e) {
      toast({ title: 'Failed to cancel', description: e.message, variant: 'destructive' })
    }
    setCancelling(false)
  }

  const setRating = (r) => {
    const val = form.rating === r ? null : r
    setForm(f => ({ ...f, rating: val }))
  }

  const addTag = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault()
      const tags = [...(form.tags || []), tagInput.trim()]
      setForm(f => ({ ...f, tags }))
      setTagInput('')
    }
  }

  const removeTag = (t) => setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }))

  const addQuote = (text) => {
    const q = { id: Date.now().toString(), text, tag: '', color: 'brand' }
    setForm(f => {
      const quotes = [...(f.quotes || []), q]
      autoSave({ quotes })
      return { ...f, quotes }
    })
    setNewQuote(''); setSelectedText('')
  }

  const removeQuote = (id) => setForm(f => {
    const quotes = f.quotes.filter(q => q.id !== id)
    autoSave({ quotes })
    return { ...f, quotes }
  })

  const handleUpload = async (e, fileType) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try { await upload(file, fileType); toast({ title: 'Uploaded', variant: 'success' }) }
    catch (err) { toast({ title: 'Upload failed', description: err.message, variant: 'destructive' }) }
    setUploading(false)
    e.target.value = ''
  }

  const handleSendPrize = async () => {
    if (!prizeCode.trim()) { toast({ title: 'Enter a promo code first', variant: 'destructive' }); return }
    setSendingPrize(true)
    try {
      const pWithCode = { ...participant, promo_code: prizeCode }
      const prizeTemplate = templates.find(t => t.trigger_type === 'prize' && t.channel === 'email')
      const waTemplate    = templates.find(t => t.trigger_type === 'prize' && t.channel === 'whatsapp')

      if (prizeTemplate) {
        const body    = applyTemplateVars(prizeTemplate.body, pWithCode, study)
        const subject = applyTemplateVars(prizeTemplate.subject || 'Your prize is here!', pWithCode, study)
        await sendEmail({ to: participant.email, subject, body, isHtml: prizeTemplate.is_html })
        await supabase.from('send_log').insert({ workspace_id: workspace.id, participant_id: participantId, template_id: prizeTemplate.id, channel: 'email', status: 'sent', subject, body_preview: body.slice(0,200) })
      }

      const normPhone = (raw) => raw?.includes('|') ? `${raw.split('|')[0]}${raw.split('|')[1].replace(/\D/g,'')}` : (raw || '')
      if (waTemplate && participant.phone) {
        const body = applyTemplateVars(waTemplate.body, pWithCode, study)
        await sendWhatsApp({ to: normPhone(participant.phone), body })
        await supabase.from('send_log').insert({ workspace_id: workspace.id, participant_id: participantId, template_id: waTemplate.id, channel: 'whatsapp', status: 'sent', body_preview: body.slice(0,200) })
      }

      await update(participantId, { status: 'prize-granted', promo_code: prizeCode })
      setForm(f => ({ ...f, status: 'prize-granted', promo_code: prizeCode }))
      await refetchLogs()
      toast({ title: 'Prize sent!', description: `Code ${prizeCode} sent to ${participant.name}`, variant: 'success' })
      setPrizeCode('')
    } catch (e) {
      toast({ title: 'Failed to send prize', description: e.message, variant: 'destructive' })
    }
    setSendingPrize(false)
  }

  const fmtBytes = (b) => b < 1024*1024 ? `${(b/1024).toFixed(0)} KB` : `${(b/1024/1024).toFixed(1)} MB`

  if (!form) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>

  return (
    <div className="p-8">
      {/* Back */}
      <button onClick={() => navigate(`/studies/${studyId}`)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors">
        <ArrowLeft className="h-4 w-4" /> {study?.name || 'Back to study'}
      </button>

      {/* Profile header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-semibold text-lg">
            {form.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-semibold">{form.name}</h1>
              <StatusBadge status={form.status} />
            </div>
            <div className="text-sm text-muted-foreground mt-0.5">
              {form.email} {form.phone && `· ${form.phone}`} {form.location && `· ${form.location}`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {form.meet_link && (
            <a href={form.meet_link} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5"><ExternalLink className="h-3.5 w-3.5" /> Join call</Button>
            </a>
          )}
          {form.status === 'booked' && (
            <Button variant="outline" size="sm" className="gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 border-red-200" onClick={handleCancel} disabled={cancelling}>
              <XCircle className="h-3.5 w-3.5" /> {cancelling ? 'Cancelling…' : 'Cancel booking'}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowSend(true)} className="gap-1.5">
            <Send className="h-3.5 w-3.5" /> Send message
          </Button>
          {editing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => { setEditing(false); setForm({ ...participant }) }}>Cancel</Button>
              <Button size="sm" onClick={save}><Check className="h-3.5 w-3.5 mr-1" /> Save</Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit</Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="notes">Notes & Quotes</TabsTrigger>
          <TabsTrigger value="uploads">Uploads</TabsTrigger>
          <TabsTrigger value="comms">Comms</TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-4">

              {/* Basic info */}
              <Card className="shadow-none">
                <CardHeader className="pb-3"><CardTitle className="text-sm">Participant info</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {editing ? (
                    <div className="grid grid-cols-2 gap-3">
                      {[['name','Full name','text'],['email','Email','email'],['phone','Phone','tel'],['location','Location','text'],['age_group','Age group','text']].map(([k,l,t]) => (
                        <div key={k} className="space-y-1.5">
                          <Label className="text-xs">{l}</Label>
                          <Input type={t} value={form[k]||''} onChange={e => setForm(f=>({...f,[k]:e.target.value}))} className="h-8 text-sm" />
                        </div>
                      ))}
                      <div className="space-y-1.5">
                        <Label className="text-xs">Status</Label>
                        <Select value={form.status} onValueChange={v => setForm(f=>({...f,status:v}))}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {['booked','completed','no-show','disqualified','prize-granted','cancelled'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Scheduled at</Label>
                        <Input type="datetime-local" value={form.booked_at?.slice(0,16)||''} onChange={e => setForm(f=>({...f,booked_at:e.target.value}))} className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1.5 col-span-2">
                        <Label className="text-xs">Meet link</Label>
                        <Input value={form.meet_link||''} onChange={e => setForm(f=>({...f,meet_link:e.target.value}))} className="h-8 text-sm" />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {[
                        ['Email',       form.email],
                        ['Phone',       form.phone],
                        ['Location',    form.location],
                        ['Age group',   form.age_group],
                        ['Scheduled',   formatDateTime(form.booked_at)],
                        ['Promo code',  form.promo_code],
                      ].filter(([,v]) => v).map(([l,v]) => (
                        <div key={l}>
                          <div className="text-xs text-muted-foreground">{l}</div>
                          <div className="font-medium">{v}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Summary */}
              <Card className="shadow-none">
                <CardHeader className="pb-3"><CardTitle className="text-sm">Session summary</CardTitle></CardHeader>
                <CardContent>
                  {editing ? (
                    <NotionEditor value={form.summary||''} onChange={v => setForm(f=>({...f,summary:v}))} placeholder="Write a summary of this session…" />
                  ) : (
                    form.summary
                      ? <NotionEditor value={form.summary} readOnly />
                      : <p className="text-sm text-muted-foreground">No summary yet.</p>
                  )}
                </CardContent>
              </Card>

              {/* Form responses (grouped by step) */}
              {formFields.length > 0 && participant?.form_data && (() => {
                const stepCount = Math.max(...formFields.map(f => f.step || 1))
                const steps = Array.from({ length: stepCount }, (_, i) => i + 1)
                return steps.map(stepNum => {
                  const stepFields = formFields.filter(f => (f.step || 1) === stepNum)
                  const hasAnswers = stepFields.some(f => participant.form_data[f.id] != null && participant.form_data[f.id] !== '')
                  if (!hasAnswers) return null
                  return (
                    <Card key={stepNum} className="shadow-none">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">
                          {stepCount > 1 ? `Form responses — Step ${stepNum}` : 'Form responses'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {stepFields.map(field => {
                            const val = participant.form_data[field.id]
                            if (val == null || val === '') return null
                            const display = Array.isArray(val) ? val.join(', ') : String(val)
                            return (
                              <div key={field.id}>
                                <div className="text-xs text-muted-foreground mb-0.5">{field.label}</div>
                                <div className="text-sm font-medium">{display}</div>
                              </div>
                            )
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              })()}
            </div>

            <div className="space-y-4">
              {/* Rating */}
              <Card className="shadow-none">
                <CardHeader className="pb-3"><CardTitle className="text-sm">Session rating</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(r => (
                      <button key={r} type="button" onClick={() => editing && setRating(r)} className={cn(!editing && 'cursor-default')}>
                        <Star className={cn('h-5 w-5', r <= (form.rating||0) ? 'fill-amber-400 text-amber-400' : 'text-gray-200 hover:text-amber-300')} />
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Tags */}
              <Card className="shadow-none">
                <CardHeader className="pb-3"><CardTitle className="text-sm">Tags</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(form.tags||[]).map(t => (
                      <span key={t} className="inline-flex items-center gap-1 rounded-full bg-brand-50 border border-brand-200 text-brand-600 text-xs px-2.5 py-0.5">
                        {t}
                        {editing && <button onClick={() => removeTag(t)}><X className="h-3 w-3" /></button>}
                      </span>
                    ))}
                  </div>
                  {editing && (
                    <Input
                      placeholder="Type tag, press Enter"
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={addTag}
                      className="h-7 text-xs"
                    />
                  )}
                </CardContent>
              </Card>

              {/* Prize section */}
              <Card className="shadow-none border-amber-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Gift className="h-4 w-4 text-amber-500" /> Send prize
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {form.status === 'prize-granted' ? (
                    <div className="text-sm text-green-600 flex items-center gap-1.5">
                      <Check className="h-4 w-4" /> Prize sent · Code: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{form.promo_code}</code>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        placeholder="Enter promo code"
                        value={prizeCode}
                        onChange={e => setPrizeCode(e.target.value)}
                        className="h-8 text-sm font-mono"
                      />
                      <Button size="sm" className="w-full gap-1.5 bg-amber-500 hover:bg-amber-600 text-white" onClick={handleSendPrize} disabled={sendingPrize || !prizeCode}>
                        <Gift className="h-3.5 w-3.5" />
                        {sendingPrize ? 'Sending…' : 'Send prize (email + WhatsApp)'}
                      </Button>
                      <p className="text-xs text-muted-foreground">Status will change to "Prize granted" after sending.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ── Notes & Quotes ── */}
        <TabsContent value="notes">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Card className="shadow-none">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Session notes</CardTitle>
                    {selectedText && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => addQuote(selectedText)}>
                        <Quote className="h-3 w-3" /> Add as quote
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <NotionEditor
                    value={form.notes||''}
                    onChange={v => { setForm(f=>({...f,notes:v})); autoSave({ notes: v }) }}
                    placeholder="Take notes during or after the session. Select any text to add it as a quote."
                    onTextSelect={setSelectedText}
                  />
                </CardContent>
              </Card>
            </div>

            <div>
              <Card className="shadow-none">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Key quotes</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 mb-3">
                    {(form.quotes||[]).length === 0 && (
                      <p className="text-xs text-muted-foreground">Select text in notes to add quotes.</p>
                    )}
                    {(form.quotes||[]).map(q => (
                      <div key={q.id} className="quote-card p-3 relative group">
                        <p className="text-sm italic text-foreground">"{q.text}"</p>
                        <button
                          onClick={() => removeQuote(q.id)}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {/* Manual quote input */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type a quote manually…"
                      value={newQuote}
                      onChange={e => setNewQuote(e.target.value)}
                      className="text-xs h-8"
                      onKeyDown={e => { if (e.key === 'Enter' && newQuote.trim()) addQuote(newQuote) }}
                    />
                    <Button size="sm" className="h-8 shrink-0" disabled={!newQuote.trim()} onClick={() => addQuote(newQuote)}>
                      Add
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ── Uploads ── */}
        <TabsContent value="uploads">
          <div className="space-y-4">
            {/* Upload buttons */}
            <div className="flex gap-2 flex-wrap">
              {[
                { type: 'video',      label: 'Upload video',      icon: Video,    accept: 'video/*'               },
                { type: 'image',      label: 'Upload image',      icon: Image,    accept: 'image/*'               },
                { type: 'document',   label: 'Upload document',   icon: FileText, accept: '.pdf,.docx,.doc,.xlsx' },
                { type: 'transcript', label: 'Upload transcript',  icon: File,     accept: '.txt,.vtt,.srt'        },
              ].map(({ type, label, icon: Icon, accept }) => (
                <label key={type} className={cn('inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium cursor-pointer transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground', uploading && 'opacity-50 pointer-events-none')}>
                  <Icon className="h-3.5 w-3.5" />
                  {uploading ? 'Uploading…' : label}
                  <input type="file" accept={accept} className="hidden" onChange={e => handleUpload(e, type)} disabled={uploading} />
                </label>
              ))}
            </div>

            {/* File grid by type */}
            {['video','image','document','transcript'].map(type => {
              const typeFiles = files.filter(f => f.file_type === type)
              if (typeFiles.length === 0) return null
              const Icon = FILE_ICONS[type]
              return (
                <Card key={type} className="shadow-none">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm capitalize flex items-center gap-1.5">
                      <Icon className="h-4 w-4 text-muted-foreground" /> {type}s
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {type === 'image' ? (
                      <div className="grid grid-cols-4 gap-2">
                        {typeFiles.map(f => (
                          <div key={f.id} className="relative group rounded-md overflow-hidden bg-muted aspect-square">
                            {fileUrls[f.id] && <img src={fileUrls[f.id]} alt={f.filename} className="w-full h-full object-cover" />}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                              <a href={fileUrls[f.id]} target="_blank" rel="noreferrer" className="p-1 rounded bg-white/20 hover:bg-white/40 transition-colors">
                                <ExternalLink className="h-3.5 w-3.5 text-white" />
                              </a>
                              <button onClick={() => removeFile(f.id, f.storage_path)} className="p-1 rounded bg-white/20 hover:bg-red-500/80 transition-colors">
                                <Trash2 className="h-3.5 w-3.5 text-white" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {typeFiles.map(f => (
                          <div key={f.id} className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                <div className="text-sm font-medium truncate">{f.filename}</div>
                                <div className="text-xs text-muted-foreground">{fmtBytes(f.size_bytes || 0)} · {formatDate(f.created_at)}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 ml-2">
                              {fileUrls[f.id] && (
                                <a href={fileUrls[f.id]} target="_blank" rel="noreferrer">
                                  <Button variant="ghost" size="icon" className="h-7 w-7"><ExternalLink className="h-3.5 w-3.5" /></Button>
                                </a>
                              )}
                              <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => removeFile(f.id, f.storage_path)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}

            {files.length === 0 && !fLoading && (
              <div className="text-center py-12 text-sm text-muted-foreground">No files uploaded yet.</div>
            )}
          </div>
        </TabsContent>

        {/* ── Comms ── */}
        <TabsContent value="comms">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Message history</h3>
              <Button size="sm" variant="outline" onClick={() => setShowSend(true)}>
                <Send className="h-3.5 w-3.5 mr-1.5" /> Send message
              </Button>
            </div>

            {logs.length === 0 ? (
              <Card className="shadow-none">
                <CardContent className="py-10 text-center text-sm text-muted-foreground">No messages sent yet.</CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {logs.map(log => {
                  const Icon = CHANNEL_ICONS[log.channel] || Mail
                  return (
                    <div key={log.id} className="flex items-start gap-3 p-4 rounded-lg border bg-white hover:bg-muted/20 transition-colors">
                      <div className={cn('p-2 rounded-full shrink-0', log.channel === 'email' ? 'bg-blue-50' : 'bg-green-50')}>
                        <Icon className={cn('h-4 w-4', log.channel === 'email' ? 'text-blue-500' : 'text-green-500')} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium">{log.templates?.name || 'Manual send'}</span>
                          <Badge variant={log.status === 'sent' ? 'success' : 'destructive'} className="text-[10px] px-1.5">
                            {log.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground capitalize">{log.channel}</span>
                        </div>
                        {log.subject && <div className="text-xs text-muted-foreground font-medium mb-0.5">Subject: {log.subject}</div>}
                        {log.body_preview && <div className="text-xs text-muted-foreground line-clamp-2">{log.body_preview}</div>}
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(log.sent_at)}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Send comms modal */}
      {showSend && (
        <SendCommsModal
          open={showSend}
          onClose={() => setShowSend(false)}
          participant={participant}
          templates={templates}
          study={study}
          onSent={() => refetchLogs()}
        />
      )}
    </div>
  )
}
