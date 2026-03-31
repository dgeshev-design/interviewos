import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStudies } from '@/hooks/useStudies'
import { useParticipants } from '@/hooks/useParticipants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import PageHeader from '@/components/layout/PageHeader'
import { useApp } from '@/context/AppContext'
import { cn, formatDate } from '@/lib/utils'
import { Plus, Users, ArrowRight, MoreHorizontal, Copy } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

const STATUS_COLORS = {
  active: 'success',
  draft:  'secondary',
  closed: 'outline',
}

export default function Studies() {
  const { studies, loading, add, update, remove, duplicate } = useStudies()
  const { participants } = useParticipants()
  const { user } = useApp()
  const navigate = useNavigate()

  const [showNew, setShowNew]   = useState(false)
  const [form, setForm]         = useState({ name: '', description: '', target_count: 10, status: 'active' })
  const [saving, setSaving]     = useState(false)
  const [confirmState, setConfirmState] = useState(null)

  const handleCreate = async () => {
    if (!form.name) return
    setSaving(true)
    try { await add(form); setForm({ name: '', description: '', target_count: 10, status: 'active' }); setShowNew(false) }
    catch (e) { alert(e.message) }
    setSaving(false)
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Studies"
        description="Organise your research by project"
        actions={
          <Button size="sm" onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> New study
          </Button>
        }
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : studies.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="py-16 text-center">
            <p className="text-sm text-muted-foreground mb-4">No studies yet. Create your first one to get started.</p>
            <Button onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1.5" /> New study</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {studies.map(study => {
            const studyPs   = participants.filter(p => p.study_id === study.id)
            const completed = studyPs.filter(p => p.status === 'completed' || p.status === 'prize-granted').length
            const pct       = study.target_count ? Math.round((completed / study.target_count) * 100) : 0

            return (
              <Card key={study.id} className="shadow-none hover:border-gray-300 transition-colors cursor-pointer" onClick={() => navigate(`/studies/${study.id}`)}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 mb-1">
                        <h3 className="font-semibold text-sm">{study.name}</h3>
                        <Badge variant={STATUS_COLORS[study.status] || 'secondary'} className="text-[10px]">
                          {study.status}
                        </Badge>
                      </div>
                      {study.description && (
                        <p className="text-xs text-muted-foreground mb-3 line-clamp-1">{study.description}</p>
                      )}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Users className="h-3 w-3" />
                          {studyPs.length} participants
                        </div>
                        <div className="flex items-center gap-2 flex-1 max-w-[200px]">
                          <Progress value={pct} className="h-1.5 flex-1" />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{completed}/{study.target_count}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">Created {formatDate(study.created_at)}</div>
                        {study.created_by && (
                          <div className={cn(
                            'inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium',
                            study.created_by === user?.id
                              ? 'bg-brand-50 text-brand-600 border border-brand-200'
                              : 'bg-gray-100 text-gray-500 border border-gray-200'
                          )}>
                            {study.created_by === user?.id ? 'You' : 'Team'}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-4" onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {['active','draft','closed'].map(s => (
                            <DropdownMenuItem key={s} onClick={() => update(study.id, { status: s })}>
                              Mark as {s}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuItem onClick={async () => {
                            try { await duplicate(study.id) }
                            catch (e) { alert(e.message) }
                          }}>
                            <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate study
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setConfirmState({ title: 'Delete study?', description: 'This cannot be undone.', onConfirm: () => remove(study.id) })}>
                            Delete study
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/studies/${study.id}`)}>
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>New study</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Study name *</Label>
              <Input placeholder="e.g. Q1 Onboarding Research" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input placeholder="Brief description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Target number of participants</Label>
              <Input type="number" min={1} value={form.target_count} onChange={e => setForm(f => ({ ...f, target_count: Number(e.target.value) }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!form.name || saving}>
              {saving ? 'Creating…' : 'Create study'}
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
