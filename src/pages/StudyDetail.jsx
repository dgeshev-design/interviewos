import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useStudies } from '@/hooks/useStudies'
import { useParticipants } from '@/hooks/useParticipants'
import { useApp } from '@/context/AppContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import StatusBadge from '@/components/ui/status-badge'
import PageHeader from '@/components/layout/PageHeader'
import { formatDateTime, cn } from '@/lib/utils'
import { Plus, Search, ArrowLeft, Star, ExternalLink, Copy, Check, Trash2, Edit2, ChevronUp, ChevronDown, Upload, Share2, Sparkles, Quote } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import PhoneCountryPicker from '@/components/ui/PhoneCountryPicker'
import NotionEditor from '@/components/ui/notion-editor'
import { callAI } from '@/lib/api'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

// ── Constants ──────────────────────────────────────────────────────────────
const EMPTY_P = { name: '', email: '', phone: '', age_group: '', location: '', status: 'booked', booked_at: '', meet_link: '', notes: '' }

const FIELD_TYPES = [
  { value: 'text',           label: 'Short text' },
  { value: 'email',          label: 'Email' },
  { value: 'tel',            label: 'Phone number' },
  { value: 'number',         label: 'Number' },
  { value: 'textarea',       label: 'Long text' },
  { value: 'select',         label: 'Single select' },
  { value: 'multi_select',   label: 'Multi select' },
  { value: 'nps',            label: 'NPS scale (0–10)' },
  { value: 'consent_checks', label: 'Mandatory checks' },
]

const PARTICIPANT_INFO_FIELDS = [
  { value: 'name',       label: 'Full name'  },
  { value: 'email',      label: 'Email'      },
  { value: 'phone',      label: 'Phone'      },
  { value: 'occupation', label: 'Occupation' },
  { value: 'location',   label: 'Location'   },
  { value: 'age_group',  label: 'Age group'  },
]

const EMPTY_FIELD = {
  id: '', label: '', type: 'text', required: false,
  options: [], is_screener: false, disqualify_if: '',
  condition_field: '', condition_value: '',
  phone_default_code: 'GB', phone_lock_code: false,
  consent_items: [], show_select_all: false,
  participant_field: '',
}


export default function StudyDetail() {
  const { studyId } = useParams()
  const navigate    = useNavigate()
  const { studies } = useStudies()
  const { participants, loading: pLoading, add } = useParticipants(studyId)
  const { workspace } = useApp()
  const { toast } = useToast()

  const study = studies.find(s => s.id === studyId)

  // Tabs — URL-driven via ?tab=
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') || 'participants'
  const setTab = (t) => setSearchParams(p => { const n = new URLSearchParams(p); n.set('tab', t); return n }, { replace: true })

  const [confirmState, setConfirmState] = useState(null)

  // Participants
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [newP, setNewP]       = useState(EMPTY_P)
  const [saving, setSaving]   = useState(false)
  const [copied, setCopied]           = useState(false)
  const [copiedReport, setCopiedReport] = useState(false)

  // Summary tab
  const [synthesis, setSynthesis]           = useState('')
  const [savingSynthesis, setSavingSynthesis] = useState(false)
  const [aiSettings, setAiSettings]         = useState(null)
  const [generatingSynthesis, setGeneratingSynthesis] = useState(false)
  const [synthesisKey, setSynthesisKey]     = useState(0)
  const synthesisTimer = useRef(null)
  useEffect(() => { document.title = study ? `${study.name} | InterviewOS` : 'Study | InterviewOS' }, [study?.name])
  useEffect(() => { if (study?.synthesis != null) setSynthesis(study.synthesis) }, [study?.id])
  useEffect(() => {
    if (!workspace) return
    supabase.from('ai_settings').select('*').eq('workspace_id', workspace.id).maybeSingle()
      .then(({ data }) => setAiSettings(data || null))
  }, [workspace?.id])

  const saveSynthesis = async (val) => {
    setSavingSynthesis(true)
    const { error } = await supabase.from('studies').update({ synthesis: val }).eq('id', studyId)
    if (error) toast({ title: 'Save failed', description: error.message, variant: 'destructive' })
    setSavingSynthesis(false)
  }
  const autoSaveSynthesis = (val) => {
    setSynthesis(val)
    clearTimeout(synthesisTimer.current)
    synthesisTimer.current = setTimeout(() => saveSynthesis(val), 800)
  }

  const generateSynthesisWithAI = async () => {
    if (!aiSettings?.api_key) return
    // Collect all quotes from all participants
    const allQuotes = participants.flatMap(p =>
      (p.quotes || []).map(q => ({ text: q.text, participantName: p.name }))
    )
    if (!allQuotes.length) {
      toast({ title: 'No quotes yet', description: 'Add quotes to participant transcripts first.', variant: 'destructive' })
      return
    }
    setGeneratingSynthesis(true)
    try {
      const result = await callAI({ action: 'generate-synthesis', quotes: allQuotes, ai_settings: aiSettings })
      if (result.error) throw new Error(result.error)
      // Convert plain text to EditorJS JSON blocks
      const rawBlocks = []
      for (const chunk of (result.synthesis || '').split(/\n\n+/).filter(Boolean)) {
        const lines = chunk.split('\n').map(l => l.trim()).filter(Boolean)
        let bulletItems = []
        const flushBullets = () => {
          if (!bulletItems.length) return
          rawBlocks.push({ id: crypto.randomUUID(), type: 'list', data: { style: 'unordered', items: bulletItems } })
          bulletItems = []
        }
        for (const line of lines) {
          if (/^[-•]\s+/.test(line)) {
            bulletItems.push(line.replace(/^[-•]\s+/, ''))
          } else {
            flushBullets()
            const isHeader = line.length < 60 && !/[.!?,]$/.test(line)
            rawBlocks.push(isHeader
              ? { id: crypto.randomUUID(), type: 'header', data: { text: line, level: 3 } }
              : { id: crypto.randomUUID(), type: 'paragraph', data: { text: line } }
            )
          }
        }
        flushBullets()
      }
      const json = JSON.stringify({ time: Date.now(), blocks: rawBlocks, version: '2.28.0' })
      autoSaveSynthesis(json)
      setSynthesisKey(k => k + 1)
      toast({ title: 'Synthesis generated', variant: 'success' })
    } catch (e) {
      toast({ title: 'AI error', description: e.message, variant: 'destructive' })
    }
    setGeneratingSynthesis(false)
  }

  // Form builder
  const [form, setForm]               = useState(null)
  const [formLoading, setFormLoading] = useState(false)
  const [savingForm, setSavingForm]   = useState(false)
  const [editingField, setEditingField] = useState(null)
  const [showFieldModal, setShowFieldModal] = useState(false)
  const [newOption, setNewOption] = useState('')
  const [activeStep, setActiveStep] = useState(1)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [uploadingLogo, setUploadingLogo]     = useState(false)
  const bannerRef = useRef()
  const logoRef   = useRef()
  const [bookingConfig, setBookingConfig] = useState(form?.booking_config || {})

  // ── Load / create form ───────────────────────────────────────────────────
  const loadForm = useCallback(async () => {
    if (!studyId || !workspace) return
    setFormLoading(true)
    const { data } = await supabase
      .from('forms')
      .select('*')
      .eq('study_id', studyId)
      .eq('is_active', true)
      .maybeSingle()
    if (data) {
      setForm(data)
    } else {
      const defaultFields = [
        { id: crypto.randomUUID(), label: 'Full name', type: 'text',  required: true, system: true, participant_field: 'name',  options: [], is_screener: false, disqualify_if: '', condition_field: '', condition_value: '' },
        { id: crypto.randomUUID(), label: 'Email',     type: 'email', required: true, system: true, participant_field: 'email', options: [], is_screener: false, disqualify_if: '', condition_field: '', condition_value: '' },
      ]
      const { data: created, error } = await supabase
        .from('forms')
        .insert({ study_id: studyId, workspace_id: workspace.id, is_active: true, fields: defaultFields, primary_color: '#6366f1' })
        .select()
        .single()
      if (!error) setForm(created)
    }
    setFormLoading(false)
  }, [studyId, workspace])

  useEffect(() => {
    if (tab === 'form' && !form) loadForm()
  }, [tab, form, loadForm])

  // ── Save form patch ──────────────────────────────────────────────────────
  const saveForm = async (patch) => {
    if (!form) return
    setSavingForm(true)
    const { error } = await supabase.from('forms').update(patch).eq('id', form.id)
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' })
    } else {
      setForm(f => ({ ...f, ...patch }))
      toast({ title: 'Saved', variant: 'success' })
    }
    setSavingForm(false)
  }

  useEffect(() => { if (form) setBookingConfig(form.booking_config || {}) }, [form?.id])

  const saveBookingConfig = async (cfg) => {
    await saveForm({ booking_config: cfg })
    setBookingConfig(cfg)
    toast({ title: 'Booking settings saved', variant: 'success' })
  }

  // ── Field helpers ────────────────────────────────────────────────────────
  // Derive stepCount from both step_titles (added but no fields yet) and actual field step numbers
  const stepCount  = form ? Math.max(1, (form.step_titles?.length || 0) + 1, ...(form.fields || []).map(f => f.step || 1)) : 1
  const stepTitles = form?.step_titles || []

  const addStep = async () => {
    if (stepCount >= 3) return
    const next = stepCount + 1
    setActiveStep(next)
    await saveForm({ step_titles: [...stepTitles, ''] })
  }

  const removeStep = async (stepNum) => {
    if (stepNum <= 1) return
    setConfirmState({ title: `Remove Step ${stepNum}?`, description: 'Its fields will be moved to Step 1.', onConfirm: async () => {
      const fields = (form.fields || []).map(f => f.step === stepNum ? { ...f, step: 1 } : f)
      const titles = (form.step_titles || []).slice(0, stepNum - 1)
      setActiveStep(Math.min(activeStep, stepNum - 1))
      await saveForm({ fields, step_titles: titles })
    }})
  }

  const openNewField = () => {
    setEditingField({ ...EMPTY_FIELD, id: crypto.randomUUID(), step: activeStep })
    setNewOption('')
    setShowFieldModal(true)
  }

  const openEditField = (f) => {
    setEditingField({ ...f })
    setNewOption('')
    setShowFieldModal(true)
  }

  const saveField = async () => {
    if (!editingField?.label?.trim()) return
    const fields = form.fields || []
    const exists = fields.some(f => f.id === editingField.id)
    const next = exists
      ? fields.map(f => f.id === editingField.id ? editingField : f)
      : [...fields, editingField]
    await saveForm({ fields: next })
    setShowFieldModal(false)
    setEditingField(null)
  }

  const deleteField = async (id) => {
    const next = (form.fields || []).filter(f => f.id !== id)
    await saveForm({ fields: next })
  }

  const moveField = async (id, dir) => {
    const all = [...(form.fields || [])]
    const stepFields = all.filter(f => (f.step || 1) === activeStep)
    const stepIdx = stepFields.findIndex(f => f.id === id)
    if (dir === -1 && stepIdx === 0) return
    if (dir === 1  && stepIdx === stepFields.length - 1) return
    const [item] = stepFields.splice(stepIdx, 1)
    stepFields.splice(stepIdx + dir, 0, item)
    // Rebuild full fields array preserving other steps
    const otherFields = all.filter(f => (f.step || 1) !== activeStep)
    await saveForm({ fields: [...otherFields, ...stepFields] })
  }

  const addOption = () => {
    const v = newOption.trim()
    if (!v) return
    setEditingField(f => ({ ...f, options: [...(f.options || []), v] }))
    setNewOption('')
  }

  const removeOption = (o) => {
    setEditingField(f => ({ ...f, options: f.options.filter(x => x !== o) }))
  }

  // ── Image upload ─────────────────────────────────────────────────────────
  const uploadImage = async (file, key) => {
    const setUploading = key === 'banner_url' ? setUploadingBanner : setUploadingLogo
    setUploading(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `${workspace.id}/${form.id}/${key}.${ext}`

      // Read file as base64 and proxy through API (service key bypasses RLS/CORS)
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload  = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const res = await fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upload', path, contentType: file.type, data: base64 }),
      })
      const resData = await res.json()
      if (!res.ok) throw new Error(resData.error || 'Upload failed')
      await saveForm({ [key]: resData.publicUrl })
    } catch (e) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' })
    }
    setUploading(false)
  }

  // ── Participants helpers ─────────────────────────────────────────────────
  const filtered  = participants.filter(p => {
    const mF = filter === 'all' || p.status === filter
    const mS = !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.email?.toLowerCase().includes(search.toLowerCase())
    return mF && mS
  })
  const completed = participants.filter(p => p.status === 'completed' || p.status === 'prize-granted').length
  const pct       = study?.target_count ? Math.round((completed / study.target_count) * 100) : 0
  const publicUrl  = study ? `${window.location.origin}/s/${study.slug}` : ''
  const reportUrl  = study?.report_token ? `${window.location.origin}/report/${study.report_token}` : ''

  const copyLink = () => {
    navigator.clipboard?.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast({ title: 'Link copied', variant: 'success' })
  }

  const copyReportLink = () => {
    if (!reportUrl) return
    navigator.clipboard?.writeText(reportUrl)
    setCopiedReport(true)
    setTimeout(() => setCopiedReport(false), 2000)
    toast({ title: 'Report link copied', variant: 'success' })
  }

  const handleAdd = async () => {
    setSaving(true)
    try { await add({ ...newP, study_id: studyId }); setNewP(EMPTY_P); setShowAdd(false) }
    catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }) }
    setSaving(false)
  }

  if (!study && !pLoading) return (
    <div className="p-8"><p className="text-sm text-muted-foreground">Study not found.</p></div>
  )

  return (
    <div className="p-8">
      <button onClick={() => navigate('/studies')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors">
        <ArrowLeft className="h-4 w-4" /> All studies
      </button>

      <PageHeader
        title={study?.name || '…'}
        description={study?.description}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={copyLink}>
              {copied ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
              {copied ? 'Copied!' : 'Copy booking link'}
            </Button>
            {reportUrl && (
              <Button variant="outline" size="sm" onClick={copyReportLink}>
                {copiedReport ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Share2 className="h-3.5 w-3.5 mr-1.5" />}
                {copiedReport ? 'Copied!' : 'Share report'}
              </Button>
            )}
            {tab === 'participants' && (
              <Button size="sm" onClick={() => setShowAdd(true)}>
                <Plus className="h-4 w-4 mr-1.5" /> Add participant
              </Button>
            )}
          </div>
        }
      />

      {/* Progress */}
      {study && (
        <div className="flex items-center gap-3 mb-6 p-4 rounded-lg border bg-white">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium">Study progress</span>
              <span className="text-xs text-muted-foreground">{completed} of {study.target_count} completed</span>
            </div>
            <Progress value={pct} className="h-2" />
          </div>
          <div className="text-lg font-bold text-brand-600 ml-2">{pct}%</div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex rounded-md border overflow-hidden text-xs mb-6 w-fit">
        {[['participants','Participants'],['form','Form builder'],['summary','Summary']].map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2 transition-colors', tab === t ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
            {label}
          </button>
        ))}
      </div>

      {/* ── PARTICIPANTS TAB ─────────────────────────────────────────────── */}
      {tab === 'participants' && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search participants…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
            </div>
            <div className="flex rounded-md border overflow-hidden text-xs">
              {['all','booked','completed','no-show','prize-granted'].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={cn('px-3 py-1.5 capitalize', filter === f ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
                  {f === 'all' ? 'All' : f.replace('-',' ')}
                </button>
              ))}
            </div>
          </div>

          <Card className="shadow-none">
            <CardContent className="p-0">
              {pLoading ? <p className="p-6 text-sm text-muted-foreground">Loading…</p> :
               filtered.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-muted-foreground mb-3">
                    {participants.length === 0 ? 'No participants yet.' : 'No participants match your filters.'}
                  </p>
                  {participants.length === 0 && (
                    <Button size="sm" onClick={() => setShowAdd(true)}>
                      <Plus className="h-4 w-4 mr-1.5" /> Add first participant
                    </Button>
                  )}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-4 text-xs font-medium text-muted-foreground">Name</th>
                      <th className="text-left p-4 text-xs font-medium text-muted-foreground">Contact</th>
                      <th className="text-left p-4 text-xs font-medium text-muted-foreground">Scheduled</th>
                      <th className="text-left p-4 text-xs font-medium text-muted-foreground">Status</th>
                      <th className="text-left p-4 text-xs font-medium text-muted-foreground">Rating</th>
                      <th className="p-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(p => (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => navigate(`/studies/${studyId}/participants/${p.id}`)}>
                        <td className="p-4">
                          <div className="font-medium">{p.name}</div>
                          {p.tags?.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {p.tags.slice(0,2).map(t => <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">{t}</Badge>)}
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="text-muted-foreground">{p.email || '—'}</div>
                          <div className="text-xs text-muted-foreground">{p.phone || ''}</div>
                        </td>
                        <td className="p-4 text-muted-foreground text-xs">{formatDateTime(p.booked_at)}</td>
                        <td className="p-4"><StatusBadge status={p.status} /></td>
                        <td className="p-4">
                          {p.rating ? (
                            <div className="flex items-center gap-0.5">
                              {Array.from({length:5}).map((_,i) => (
                                <Star key={i} className={cn('h-3 w-3', i < p.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200')} />
                              ))}
                            </div>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="p-4">
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ── SUMMARY TAB ──────────────────────────────────────────────────── */}
      {tab === 'summary' && (() => {
        const allQuotes = participants.flatMap(p => (p.quotes || []).map(q => ({ ...q, participantName: p.name })))
        return (
          <div className={allQuotes.length ? 'grid grid-cols-3 gap-4' : ''}>
            {/* Left: synthesis editor */}
            <div className={allQuotes.length ? 'col-span-2' : ''}>
              <Card className="shadow-none">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm">Study summary</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">This summary appears at the top of your shareable report.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {savingSynthesis && <span className="text-xs text-muted-foreground">Saving…</span>}
                      {aiSettings?.enabled && aiSettings?.api_key && (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={generateSynthesisWithAI} disabled={generatingSynthesis}>
                          <Sparkles className="h-3 w-3" />
                          {generatingSynthesis ? 'Generating…' : 'AI synthesis'}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <NotionEditor
                    key={synthesisKey}
                    value={synthesis}
                    onChange={autoSaveSynthesis}
                    placeholder="Write a synthesis or summary of this study…"
                  />
                </CardContent>
              </Card>
            </div>

            {/* Right: all quotes */}
            {allQuotes.length > 0 && (
              <div>
                <Card className="shadow-none">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Quote className="h-4 w-4 text-muted-foreground" />
                      All quotes ({allQuotes.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {allQuotes.map(q => (
                        <div key={q.id} className="p-3 rounded-md border bg-muted/20">
                          <p className="text-sm italic">"{q.text}"</p>
                          <p className="text-xs text-muted-foreground mt-1">— {q.participantName}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )
      })()}

      {/* ── FORM BUILDER TAB ─────────────────────────────────────────────── */}
      {tab === 'form' && (
        formLoading ? <p className="text-sm text-muted-foreground">Loading form…</p> :
        form ? (
          <div className="space-y-5">

            {/* Branding ─────────────────────────────────────────────────── */}
            <Card className="shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Branding</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">

                {/* Banner */}
                <div className="space-y-2">
                  <Label>Banner image</Label>
                  {form.banner_url && (
                    <div className="relative rounded-lg overflow-hidden border bg-muted h-32 mb-2">
                      <img src={form.banner_url} alt="Banner" className="w-full h-full object-cover" />
                      <button
                        onClick={() => saveForm({ banner_url: null })}
                        className="absolute top-2 right-2 bg-white/90 hover:bg-white border rounded px-2 py-1 text-xs shadow-sm">
                        Remove
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Paste image URL…"
                      value={form.banner_url || ''}
                      onChange={e => setForm(f => ({ ...f, banner_url: e.target.value }))}
                      className="flex-1"
                    />
                    <Button variant="outline" size="sm" onClick={() => bannerRef.current?.click()} disabled={uploadingBanner}>
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      {uploadingBanner ? 'Uploading…' : 'Upload'}
                    </Button>
                    <Button size="sm" onClick={() => saveForm({ banner_url: form.banner_url })} disabled={savingForm}>
                      Save
                    </Button>
                  </div>
                  <input ref={bannerRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { if (e.target.files[0]) uploadImage(e.target.files[0], 'banner_url') }} />
                </div>

                {/* Logo */}
                <div className="space-y-2">
                  <Label>Logo image</Label>
                  {form.logo_url && (
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-14 w-14 rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
                        <img src={form.logo_url} alt="Logo" className="h-full w-full object-contain p-1" />
                      </div>
                      <button onClick={() => saveForm({ logo_url: null })} className="text-xs text-muted-foreground hover:text-destructive">
                        Remove
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Paste logo URL…"
                      value={form.logo_url || ''}
                      onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))}
                      className="flex-1"
                    />
                    <Button variant="outline" size="sm" onClick={() => logoRef.current?.click()} disabled={uploadingLogo}>
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      {uploadingLogo ? 'Uploading…' : 'Upload'}
                    </Button>
                    <Button size="sm" onClick={() => saveForm({ logo_url: form.logo_url })} disabled={savingForm}>
                      Save
                    </Button>
                  </div>
                  <input ref={logoRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { if (e.target.files[0]) uploadImage(e.target.files[0], 'logo_url') }} />
                </div>

                {/* Brand color */}
                <div className="space-y-2">
                  <Label>Brand color</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={form.primary_color || '#6366f1'}
                      onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
                      className="h-9 w-16 rounded border cursor-pointer p-0.5"
                    />
                    <Input
                      value={form.primary_color || '#6366f1'}
                      onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
                      className="w-28 font-mono text-sm"
                      maxLength={7}
                    />
                    <Button size="sm" onClick={() => saveForm({ primary_color: form.primary_color })} disabled={savingForm}>
                      Save
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Booking settings */}
            <Card className="shadow-none">
              <CardContent className="p-6 space-y-5">
                <div>
                  <h3 className="font-semibold text-sm mb-0.5">Booking</h3>
                  <p className="text-xs text-muted-foreground">Control how far ahead participants can book and which hours are shown.</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">How far ahead can participants book?</Label>
                  <div className="flex gap-2 items-center">
                    <Select
                      value={bookingConfig.visibility || 'days'}
                      onValueChange={v => {
                        const cfg = { ...bookingConfig, visibility: v }
                        setBookingConfig(cfg)
                      }}
                    >
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="days">Next N days</SelectItem>
                        <SelectItem value="today">Today only</SelectItem>
                        <SelectItem value="tomorrow">Today + tomorrow</SelectItem>
                        <SelectItem value="range">Custom date range</SelectItem>
                      </SelectContent>
                    </Select>
                    {(!bookingConfig.visibility || bookingConfig.visibility === 'days') && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="1" max="365"
                          className="w-20 h-9 text-sm"
                          value={bookingConfig.days_ahead || 30}
                          onChange={e => setBookingConfig(c => ({ ...c, days_ahead: parseInt(e.target.value) || 30 }))}
                        />
                        <span className="text-sm text-muted-foreground">days</span>
                      </div>
                    )}
                  </div>
                </div>

                {bookingConfig.visibility === 'range' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">From date</Label>
                      <Input type="date" value={bookingConfig.date_from || ''} onChange={e => setBookingConfig(c => ({ ...c, date_from: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">To date</Label>
                      <Input type="date" value={bookingConfig.date_to || ''} onChange={e => setBookingConfig(c => ({ ...c, date_to: e.target.value }))} />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs">Hour visibility override <span className="text-muted-foreground font-normal">(optional — leave blank to use availability rule hours)</span></Label>
                  <div className="flex items-center gap-2">
                    <Input type="time" className="w-32 h-9 text-sm" value={bookingConfig.hour_from || ''} placeholder="09:00"
                      onChange={e => setBookingConfig(c => ({ ...c, hour_from: e.target.value }))} />
                    <span className="text-sm text-muted-foreground">to</span>
                    <Input type="time" className="w-32 h-9 text-sm" value={bookingConfig.hour_to || ''} placeholder="17:00"
                      onChange={e => setBookingConfig(c => ({ ...c, hour_to: e.target.value }))} />
                  </div>
                </div>

                {/* Step counter toggle */}
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={bookingConfig.show_step_counter !== false}
                      onChange={e => setBookingConfig(c => ({ ...c, show_step_counter: e.target.checked }))}
                    />
                    <span className="text-xs text-muted-foreground">Show step progress bar to participants</span>
                  </label>
                </div>

                <Button size="sm" onClick={() => saveBookingConfig(bookingConfig)}>Save booking settings</Button>
              </CardContent>
            </Card>

            {/* Fields ───────────────────────────────────────────────────── */}
            <Card className="shadow-none">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Form fields</CardTitle>
                  <div className="flex items-center gap-2">
                    {stepCount < 3 && (
                      <Button variant="outline" size="sm" onClick={addStep}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add step
                      </Button>
                    )}
                    <Button size="sm" onClick={openNewField}>
                      <Plus className="h-4 w-4 mr-1.5" /> Add field
                    </Button>
                  </div>
                </div>

                {/* Step tabs — always visible so you can add steps before adding fields */}
                <div className="flex items-center gap-1 mt-3 flex-wrap">
                  {Array.from({ length: stepCount }, (_, i) => i + 1).map(s => (
                    <div key={s} className="flex items-center gap-1">
                      <button
                        onClick={() => setActiveStep(s)}
                        className={cn(
                          'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                          activeStep === s ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                        )}
                      >
                        {s === 1 ? (form.step_titles?.[0] || 'Step 1') : (form.step_titles?.[s - 1] || `Step ${s}`)}
                      </button>
                      {s > 1 && activeStep === s && (
                        <button onClick={() => removeStep(s)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Step title editor */}
                <input
                  className="mt-2 w-full text-xs border rounded px-2 py-1 text-muted-foreground focus:outline-none focus:border-primary"
                  placeholder={`Step ${activeStep} title (optional)`}
                  value={form.step_titles?.[activeStep - 1] || ''}
                  onChange={e => {
                    const titles = [...(form.step_titles || Array(stepCount).fill(''))]
                    titles[activeStep - 1] = e.target.value
                    setForm(f => ({ ...f, step_titles: titles }))
                  }}
                  onBlur={e => {
                    const titles = [...(form.step_titles || Array(stepCount).fill(''))]
                    titles[activeStep - 1] = e.target.value
                    saveForm({ step_titles: titles })
                  }}
                />
              </CardHeader>
              <CardContent>
                {(() => {
                  const stepFields = (form.fields || []).filter(f => (f.step || 1) === activeStep)
                  if (stepFields.length === 0) return (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground mb-3">No fields in this step yet.</p>
                      <Button size="sm" onClick={openNewField}>
                        <Plus className="h-4 w-4 mr-1.5" /> Add field
                      </Button>
                    </div>
                  )
                  return (
                    <div className="space-y-2">
                      {stepFields.map((f, idx) => (
                        <div key={f.id} className="flex items-center gap-2 p-3 rounded-md border hover:bg-muted/20 transition-colors">
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button onClick={() => moveField(f.id, -1)} disabled={idx === 0}
                              className="text-muted-foreground hover:text-foreground disabled:opacity-25">
                              <ChevronUp className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => moveField(f.id, 1)} disabled={idx === stepFields.length - 1}
                              className="text-muted-foreground hover:text-foreground disabled:opacity-25">
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium truncate">{f.label}</span>
                              {f.system && <Badge className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-600 border-blue-200">System</Badge>}
                              {f.required && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Required</Badge>}
                              {f.is_screener && <Badge className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-200">Screener</Badge>}
                              {f.condition_field && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Conditional</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {FIELD_TYPES.find(t => t.value === f.type)?.label || f.type}
                              {f.options?.length > 0 && ` · ${f.options.length} option${f.options.length !== 1 ? 's' : ''}`}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditField(f)}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            {!f.system && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive"
                                onClick={() => setConfirmState({ title: 'Delete this field?', onConfirm: () => deleteField(f.id) })}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </CardContent>
            </Card>

            {/* Preview link */}
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => window.open(publicUrl, '_blank')}>
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Preview public form
              </Button>
            </div>
          </div>
        ) : <p className="text-sm text-muted-foreground">Failed to load form.</p>
      )}

      {/* ── Add participant dialog ─────────────────────────────────────── */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add participant</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>Full name *</Label>
                <Input value={newP.name} onChange={e => setNewP(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={newP.email} onChange={e => setNewP(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={newP.phone} onChange={e => setNewP(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Age group</Label>
                <Select value={newP.age_group || '__none__'} onValueChange={v => setNewP(p => ({ ...p, age_group: v === '__none__' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {['Under 18','18-24','25-34','35-44','45-54','55+'].map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input value={newP.location} onChange={e => setNewP(p => ({ ...p, location: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Scheduled at</Label>
                <Input type="datetime-local" value={newP.booked_at} onChange={e => setNewP(p => ({ ...p, booked_at: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Meet link</Label>
                <Input placeholder="https://meet.google.com/…" value={newP.meet_link} onChange={e => setNewP(p => ({ ...p, meet_link: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!newP.name || saving}>
              {saving ? 'Adding…' : 'Add participant'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Field edit dialog ──────────────────────────────────────────── */}
      <Dialog open={showFieldModal} onOpenChange={v => { if (!v) { setShowFieldModal(false); setEditingField(null) } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingField && (form?.fields || []).some(f => f.id === editingField.id) ? 'Edit field' : 'New field'}
            </DialogTitle>
          </DialogHeader>
          {editingField && (
            <div className="space-y-4 py-2">

              {/* Label */}
              <div className="space-y-1.5">
                <Label>Question / Label *</Label>
                <Input
                  value={editingField.label}
                  onChange={e => setEditingField(f => ({ ...f, label: e.target.value }))}
                  placeholder="e.g. What is your age?"
                  autoFocus
                />
              </div>

              {/* Type */}
              <div className="space-y-1.5">
                <Label>Field type</Label>
                {editingField.system ? (
                  <div className="flex h-9 items-center px-3 rounded-md border bg-muted text-sm text-muted-foreground">
                    {FIELD_TYPES.find(t => t.value === editingField.type)?.label}
                    <span className="ml-auto text-xs text-blue-500">Locked</span>
                  </div>
                ) : (
                  <Select
                    value={editingField.type}
                    onValueChange={v => setEditingField(f => ({
                      ...f, type: v,
                      options: (v === 'select' || v === 'multi_select') ? (f.options || []) : [],
                      consent_items: v === 'consent_checks' ? (f.consent_items?.length ? f.consent_items : [{ id: crypto.randomUUID(), text: '' }]) : (f.consent_items || []),
                      required: v === 'consent_checks' ? true : f.required,
                      disqualify_if: '',
                    }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Phone code config */}
              {editingField.type === 'tel' && (
                <div className="space-y-3 rounded-lg border p-3 bg-muted/30">
                  <p className="text-sm font-medium">Phone code</p>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Default country code</Label>
                    <PhoneCountryPicker
                      value={editingField.phone_default_code || 'GB'}
                      onChange={v => setEditingField(f => ({ ...f, phone_default_code: v }))}
                    />
                  </div>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!editingField.phone_lock_code}
                      onChange={e => setEditingField(f => ({ ...f, phone_lock_code: e.target.checked }))}
                      className="rounded"
                    />
                    <span className="text-sm">Lock code (user can't change it)</span>
                  </label>
                </div>
              )}

              {/* Options (select / multi_select) */}
              {(editingField.type === 'select' || editingField.type === 'multi_select') && (
                <div className="space-y-1.5">
                  <Label>Options</Label>
                  <div className="space-y-1.5">
                    {(editingField.options || []).map((o, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="flex-1 text-sm border rounded-md px-3 py-1.5 bg-muted/30">{o}</span>
                        <button onClick={() => removeOption(o)} className="text-muted-foreground hover:text-destructive shrink-0">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add option…"
                        value={newOption}
                        onChange={e => setNewOption(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption() } }}
                      />
                      <Button variant="outline" size="sm" type="button" onClick={addOption}>Add</Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Consent items */}
              {editingField.type === 'consent_checks' && (
                <div className="space-y-3 rounded-lg border p-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Consent items</Label>
                    <span className="text-[10px] text-muted-foreground">Use [text](url) to add links</span>
                  </div>
                  <div className="space-y-2">
                    {(editingField.consent_items || []).map((item, i) => (
                      <div key={item.id} className="flex gap-2 items-center">
                        <Input
                          className="flex-1 text-sm"
                          value={item.text}
                          placeholder={`e.g. I agree to the [Privacy Policy](https://...)`}
                          onChange={e => setEditingField(f => ({
                            ...f,
                            consent_items: f.consent_items.map((ci, j) => j === i ? { ...ci, text: e.target.value } : ci),
                          }))}
                        />
                        <button
                          type="button"
                          onClick={() => setEditingField(f => ({ ...f, consent_items: f.consent_items.filter((_, j) => j !== i) }))}
                          className="text-muted-foreground hover:text-destructive shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline" size="sm" type="button"
                    onClick={() => setEditingField(f => ({ ...f, consent_items: [...(f.consent_items || []), { id: crypto.randomUUID(), text: '' }] }))}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Add item
                  </Button>
                  {(editingField.consent_items || []).length > 1 && (
                    <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={!!editingField.show_select_all}
                        onChange={e => setEditingField(f => ({ ...f, show_select_all: e.target.checked }))}
                        className="rounded"
                      />
                      <span className="text-sm">Show "Select all" checkbox</span>
                    </label>
                  )}
                </div>
              )}

              {/* Participant info mapping */}
              {editingField.type !== 'consent_checks' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Maps to participant info</Label>
                  {editingField.system ? (
                    <div className="flex h-9 items-center px-3 rounded-md border bg-muted text-sm text-muted-foreground">
                      {PARTICIPANT_INFO_FIELDS.find(pf => pf.value === editingField.participant_field)?.label || '—'}
                      <span className="ml-auto text-xs text-blue-500">Locked</span>
                    </div>
                  ) : (
                    <Select
                      value={editingField.participant_field || '__none__'}
                      onValueChange={v => setEditingField(f => ({ ...f, participant_field: v === '__none__' ? '' : v }))}>
                      <SelectTrigger><SelectValue placeholder="None (store in form responses only)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {PARTICIPANT_INFO_FIELDS.filter(pf =>
                          pf.value === editingField.participant_field ||
                          !(form?.fields || []).some(f => f.id !== editingField.id && f.participant_field === pf.value)
                        ).map(pf => (
                          <SelectItem key={pf.value} value={pf.value}>{pf.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <p className="text-[11px] text-muted-foreground">Answer will be saved directly to the participant's profile</p>
                </div>
              )}

              {/* Required */}
              <label className={cn('flex items-center gap-2.5', editingField.system || editingField.type === 'consent_checks' ? 'opacity-60' : 'cursor-pointer')}>
                <input
                  type="checkbox"
                  checked={editingField.required}
                  onChange={e => !editingField.system && editingField.type !== 'consent_checks' && setEditingField(f => ({ ...f, required: e.target.checked }))}
                  disabled={editingField.system || editingField.type === 'consent_checks'}
                  className="rounded"
                />
                <span className="text-sm font-medium">Required</span>
                {(editingField.system || editingField.type === 'consent_checks') && <span className="text-xs text-blue-500 ml-1">Always required</span>}
              </label>

              {/* Screener logic */}
              <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingField.is_screener}
                    onChange={e => setEditingField(f => ({ ...f, is_screener: e.target.checked }))}
                  />
                  <span className="text-sm font-medium">Screener question</span>
                </label>
                {editingField.is_screener && (editingField.type === 'select' || editingField.type === 'multi_select') && editingField.options?.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Disqualify participant if answer is</Label>
                    <Select
                      value={editingField.disqualify_if || '__none__'}
                      onValueChange={v => setEditingField(f => ({ ...f, disqualify_if: v === '__none__' ? '' : v }))}>
                      <SelectTrigger><SelectValue placeholder="Select disqualifying answer…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {editingField.options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {editingField.is_screener && editingField.type !== 'select' && editingField.type !== 'multi_select' && (
                  <p className="text-xs text-muted-foreground">Add "Single select" or "Multi select" options to configure a disqualify rule.</p>
                )}
              </div>

              {/* Conditional logic */}
              {(form?.fields || []).filter(f => f.id !== editingField.id && (f.type === 'select' || f.type === 'multi_select')).length > 0 && (
                <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
                  <p className="text-sm font-medium">Show only if…</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Field</Label>
                      <Select
                        value={editingField.condition_field || '__none__'}
                        onValueChange={v => setEditingField(f => ({ ...f, condition_field: v === '__none__' ? '' : v, condition_value: '' }))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Always show" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Always show</SelectItem>
                          {(form?.fields || [])
                            .filter(f => f.id !== editingField.id && (f.type === 'select' || f.type === 'multi_select'))
                            .map(f => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {editingField.condition_field && (
                      <div className="space-y-1">
                        <Label className="text-xs">Equals</Label>
                        <Select
                          value={editingField.condition_value || '__none__'}
                          onValueChange={v => setEditingField(f => ({ ...f, condition_value: v === '__none__' ? '' : v }))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any value" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Any value</SelectItem>
                            {((form?.fields || []).find(f => f.id === editingField.condition_field)?.options || [])
                              .map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowFieldModal(false); setEditingField(null) }}>Cancel</Button>
            <Button onClick={saveField} disabled={!editingField?.label?.trim() || savingForm}>
              {savingForm ? 'Saving…' : 'Save field'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.title}
        description={confirmState?.description}
        onConfirm={() => { confirmState?.onConfirm(); setConfirmState(null) }}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  )
}
