import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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
import { Plus, Search, ArrowLeft, Star, ExternalLink, Copy, Check, Trash2, Edit2, ChevronUp, ChevronDown, Upload } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// ── Constants ──────────────────────────────────────────────────────────────
const EMPTY_P = { name: '', email: '', phone: '', age_group: '', location: '', status: 'booked', booked_at: '', meet_link: '', notes: '' }

const FIELD_TYPES = [
  { value: 'text',         label: 'Short text' },
  { value: 'email',        label: 'Email' },
  { value: 'tel',          label: 'Phone number' },
  { value: 'number',       label: 'Number' },
  { value: 'textarea',     label: 'Long text' },
  { value: 'select',       label: 'Single select' },
  { value: 'multi_select', label: 'Multi select' },
  { value: 'nps',          label: 'NPS scale (0–10)' },
]

const EMPTY_FIELD = {
  id: '', label: '', type: 'text', required: false,
  options: [], is_screener: false, disqualify_if: '',
  condition_field: '', condition_value: '',
  phone_default_code: '+1', phone_lock_code: false,
}

const PHONE_CODES = [
  { code: '+1',   label: '🇺🇸 +1 (US/CA)' },
  { code: '+44',  label: '🇬🇧 +44 (UK)' },
  { code: '+49',  label: '🇩🇪 +49 (DE)' },
  { code: '+33',  label: '🇫🇷 +33 (FR)' },
  { code: '+34',  label: '🇪🇸 +34 (ES)' },
  { code: '+39',  label: '🇮🇹 +39 (IT)' },
  { code: '+31',  label: '🇳🇱 +31 (NL)' },
  { code: '+46',  label: '🇸🇪 +46 (SE)' },
  { code: '+47',  label: '🇳🇴 +47 (NO)' },
  { code: '+45',  label: '🇩🇰 +45 (DK)' },
  { code: '+358', label: '🇫🇮 +358 (FI)' },
  { code: '+41',  label: '🇨🇭 +41 (CH)' },
  { code: '+43',  label: '🇦🇹 +43 (AT)' },
  { code: '+32',  label: '🇧🇪 +32 (BE)' },
  { code: '+351', label: '🇵🇹 +351 (PT)' },
  { code: '+48',  label: '🇵🇱 +48 (PL)' },
  { code: '+420', label: '🇨🇿 +420 (CZ)' },
  { code: '+36',  label: '🇭🇺 +36 (HU)' },
  { code: '+40',  label: '🇷🇴 +40 (RO)' },
  { code: '+7',   label: '🇷🇺 +7 (RU)' },
  { code: '+380', label: '🇺🇦 +380 (UA)' },
  { code: '+90',  label: '🇹🇷 +90 (TR)' },
  { code: '+972', label: '🇮🇱 +972 (IL)' },
  { code: '+971', label: '🇦🇪 +971 (AE)' },
  { code: '+966', label: '🇸🇦 +966 (SA)' },
  { code: '+91',  label: '🇮🇳 +91 (IN)' },
  { code: '+86',  label: '🇨🇳 +86 (CN)' },
  { code: '+81',  label: '🇯🇵 +81 (JP)' },
  { code: '+82',  label: '🇰🇷 +82 (KR)' },
  { code: '+65',  label: '🇸🇬 +65 (SG)' },
  { code: '+61',  label: '🇦🇺 +61 (AU)' },
  { code: '+64',  label: '🇳🇿 +64 (NZ)' },
  { code: '+55',  label: '🇧🇷 +55 (BR)' },
  { code: '+52',  label: '🇲🇽 +52 (MX)' },
  { code: '+54',  label: '🇦🇷 +54 (AR)' },
  { code: '+56',  label: '🇨🇱 +56 (CL)' },
  { code: '+57',  label: '🇨🇴 +57 (CO)' },
  { code: '+27',  label: '🇿🇦 +27 (ZA)' },
  { code: '+20',  label: '🇪🇬 +20 (EG)' },
  { code: '+234', label: '🇳🇬 +234 (NG)' },
  { code: '+254', label: '🇰🇪 +254 (KE)' },
]

export default function StudyDetail() {
  const { studyId } = useParams()
  const navigate    = useNavigate()
  const { studies } = useStudies()
  const { participants, loading: pLoading, add } = useParticipants(studyId)
  const { workspace } = useApp()
  const { toast } = useToast()

  const study = studies.find(s => s.id === studyId)

  // Tabs
  const [tab, setTab] = useState('participants')

  // Participants
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [newP, setNewP]       = useState(EMPTY_P)
  const [saving, setSaving]   = useState(false)
  const [copied, setCopied]   = useState(false)

  // Form builder
  const [form, setForm]               = useState(null)
  const [formLoading, setFormLoading] = useState(false)
  const [savingForm, setSavingForm]   = useState(false)
  const [editingField, setEditingField] = useState(null)
  const [showFieldModal, setShowFieldModal] = useState(false)
  const [newOption, setNewOption] = useState('')
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [uploadingLogo, setUploadingLogo]     = useState(false)
  const bannerRef = useRef()
  const logoRef   = useRef()

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
        { id: crypto.randomUUID(), label: 'Full name', type: 'text',  required: true, system: true, options: [], is_screener: false, disqualify_if: '', condition_field: '', condition_value: '' },
        { id: crypto.randomUUID(), label: 'Email',     type: 'email', required: true, system: true, options: [], is_screener: false, disqualify_if: '', condition_field: '', condition_value: '' },
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

  // ── Field helpers ────────────────────────────────────────────────────────
  const openNewField = () => {
    setEditingField({ ...EMPTY_FIELD, id: crypto.randomUUID() })
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
    const fields = [...(form.fields || [])]
    const idx = fields.findIndex(f => f.id === id)
    if (dir === -1 && idx === 0) return
    if (dir === 1  && idx === fields.length - 1) return
    const [item] = fields.splice(idx, 1)
    fields.splice(idx + dir, 0, item)
    await saveForm({ fields })
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
      const { error: upErr } = await supabase.storage
        .from('form-assets')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('form-assets').getPublicUrl(path)
      await saveForm({ [key]: publicUrl })
    } catch (e) {
      toast({ title: 'Upload failed', description: 'Create a public "form-assets" bucket in Supabase Storage first. ' + e.message, variant: 'destructive' })
    }
    setUploading(false)
  }

  // ── Participants helpers ─────────────────────────────────────────────────
  const filtered  = participants.filter(p => {
    const mF = filter === 'all' || p.status === filter
    const mS = !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.email?.toLowerCase().includes(search.toLowerCase())
    return mF && mS
  })
  const completed = participants.filter(p => p.status === 'completed').length
  const pct       = study?.target_count ? Math.round((completed / study.target_count) * 100) : 0
  const publicUrl = study ? `${window.location.origin}/s/${study.slug}` : ''

  const copyLink = () => {
    navigator.clipboard?.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast({ title: 'Link copied', variant: 'success' })
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
        {[['participants','Participants'],['form','Form builder']].map(([t, label]) => (
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

            {/* Fields ───────────────────────────────────────────────────── */}
            <Card className="shadow-none">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Form fields</CardTitle>
                  <Button size="sm" onClick={openNewField}>
                    <Plus className="h-4 w-4 mr-1.5" /> Add field
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {(!form.fields || form.fields.length === 0) ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground mb-3">No fields yet. Add your first field to get started.</p>
                    <Button size="sm" onClick={openNewField}>
                      <Plus className="h-4 w-4 mr-1.5" /> Add first field
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {form.fields.map((f, idx) => (
                      <div key={f.id} className="flex items-center gap-2 p-3 rounded-md border hover:bg-muted/20 transition-colors">
                        {/* Reorder */}
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <button onClick={() => moveField(f.id, -1)} disabled={idx === 0}
                            className="text-muted-foreground hover:text-foreground disabled:opacity-25">
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => moveField(f.id, 1)} disabled={idx === form.fields.length - 1}
                            className="text-muted-foreground hover:text-foreground disabled:opacity-25">
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {/* Info */}
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
                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditField(f)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          {!f.system && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive"
                              onClick={() => { if (confirm('Delete this field?')) deleteField(f.id) }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                    <Select
                      value={editingField.phone_default_code || '+1'}
                      onValueChange={v => setEditingField(f => ({ ...f, phone_default_code: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PHONE_CODES.map(c => (
                          <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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

              {/* Required */}
              <label className={cn('flex items-center gap-2.5', editingField.system ? 'opacity-60' : 'cursor-pointer')}>
                <input
                  type="checkbox"
                  checked={editingField.required}
                  onChange={e => !editingField.system && setEditingField(f => ({ ...f, required: e.target.checked }))}
                  disabled={editingField.system}
                  className="rounded"
                />
                <span className="text-sm font-medium">Required</span>
                {editingField.system && <span className="text-xs text-blue-500 ml-1">Always required</span>}
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
    </div>
  )
}
