import { useState } from 'react'
import { useApp } from '@/context/AppContext'
import { useTemplates } from '@/hooks/useTemplates'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import TemplateModal from '@/components/comms/TemplateModal'
import { TRIGGER_LABELS } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import { useToast } from '@/hooks/use-toast'
import { Plus, Trash2, RefreshCw, Check, Mail, MessageCircle } from 'lucide-react'

const CHANNEL_COLORS = { email: 'blue', whatsapp: 'success', sms: 'secondary' }

export default function Settings() {
  const { workspace } = useApp()
  const { templates, loading: tLoading, add, update, remove } = useTemplates()
  const { toast } = useToast()

  const [showTemplate, setShowTemplate] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [wsName, setWsName]     = useState(workspace?.name || '')
  const [savingWs, setSavingWs] = useState(false)

  const saveWorkspace = async () => {
    setSavingWs(true)
    const { error } = await supabase.from('workspaces').update({ name: wsName }).eq('id', workspace.id)
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' })
    else toast({ title: 'Saved', variant: 'success' })
    setSavingWs(false)
  }

  const handleSaveTemplate = async (form) => {
    if (editingTemplate?.id) await update(editingTemplate.id, form)
    else await add(form)
    setEditingTemplate(null)
  }

  return (
    <div className="p-8 max-w-3xl">
      <PageHeader title="Settings" description="Manage your workspace and communication templates" />

      {/* Workspace */}
      <Card className="shadow-none mb-6">
        <CardHeader>
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

      {/* Google Calendar */}
      <Card className="shadow-none mb-6">
        <CardHeader>
          <CardTitle className="text-sm">Google Calendar</CardTitle>
          <CardDescription>Syncs your Google Calendar blocks and creates Meet events on booking.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm text-green-600">
              <div className="h-2 w-2 rounded-full bg-green-500 pulse-dot" />
              Connected
            </div>
            <Button variant="outline" size="sm" className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Reconnect
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Comms templates */}
      <Card className="shadow-none">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">Message templates</CardTitle>
              <CardDescription className="mt-0.5">Templates are sent automatically at their trigger time, or manually from a participant profile.</CardDescription>
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
                    <Badge variant={CHANNEL_COLORS[t.channel]} className="text-[10px]">{t.channel}</Badge>
                    <div>
                      <div className="text-sm font-medium">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{TRIGGER_LABELS[t.trigger_type]}{t.trigger_offset !== 0 ? ` · ${Math.abs(t.trigger_offset)} min ${t.trigger_offset < 0 ? 'before' : 'after'}` : ''}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setEditingTemplate(t); setShowTemplate(true) }}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => { if (confirm('Delete this template?')) remove(t.id) }}>
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
    </div>
  )
}
