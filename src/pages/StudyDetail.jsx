import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStudies } from '@/hooks/useStudies'
import { useParticipants } from '@/hooks/useParticipants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import StatusBadge from '@/components/ui/status-badge'
import PageHeader from '@/components/layout/PageHeader'
import { formatDateTime, cn } from '@/lib/utils'
import { Plus, Search, ArrowLeft, Star, ExternalLink, Copy, Check } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

const EMPTY_P = { name: '', email: '', phone: '', age_group: '', location: '', status: 'booked', booked_at: '', meet_link: '', notes: '' }

export default function StudyDetail() {
  const { studyId } = useParams()
  const navigate    = useNavigate()
  const { studies } = useStudies()
  const { participants, loading, add } = useParticipants(studyId)
  const { toast } = useToast()

  const study     = studies.find(s => s.id === studyId)
  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState('all')
  const [showAdd, setShowAdd]   = useState(false)
  const [newP, setNewP]         = useState(EMPTY_P)
  const [saving, setSaving]     = useState(false)
  const [copied, setCopied]     = useState(false)

  const filtered = participants.filter(p => {
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
    catch (e) { alert(e.message) }
    setSaving(false)
  }

  if (!study && !loading) return (
    <div className="p-8"><p className="text-sm text-muted-foreground">Study not found.</p></div>
  )

  return (
    <div className="p-8 max-w-5xl">
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
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Add participant
            </Button>
          </div>
        }
      />

      {/* Progress bar */}
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

      {/* Filters */}
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

      {/* Participants table */}
      <Card className="shadow-none">
        <CardContent className="p-0">
          {loading ? <p className="p-6 text-sm text-muted-foreground">Loading…</p> :
           filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground mb-3">
                {participants.length === 0 ? 'No participants yet.' : 'No participants match your filters.'}
              </p>
              {participants.length === 0 && <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1.5" />Add first participant</Button>}
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
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/studies/${studyId}/participants/${p.id}`)}>
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

      {/* Add participant modal */}
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
                <Select value={newP.age_group} onValueChange={v => setNewP(p => ({ ...p, age_group: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
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
    </div>
  )
}
