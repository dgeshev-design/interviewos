import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSlots } from '@/hooks/useSlots'
import { useStudies } from '@/hooks/useStudies'
import { useApp } from '@/context/AppContext'
import { generateSlots, syncGCal } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import PageHeader from '@/components/layout/PageHeader'
import StatusBadge from '@/components/ui/status-badge'
import { formatTime, formatDate, cn } from '@/lib/utils'
import { addDays, startOfWeek, format, isSameDay, parseISO, isToday } from 'date-fns'
import { ChevronLeft, ChevronRight, RefreshCw, CalendarPlus, List, LayoutGrid, Plus } from 'lucide-react'

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8) // 8am – 8pm
const DAYS  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

export default function Calendar() {
  const { workspace } = useApp()
  const { slots, loading, addSlot, removeSlot, refetch } = useSlots()
  const { studies } = useStudies()
  const navigate = useNavigate()

  const [view, setView]           = useState('week')
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [showWindow, setShowWindow] = useState(false)
  const [syncing, setSyncing]     = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genResult, setGenResult] = useState(null)

  const [windowForm, setWindowForm] = useState({
    studyId: '', dateFrom: '', dateTo: '',
    timeFrom: '09:00', timeTo: '17:00',
    durationMinutes: 60, bufferMinutes: 15,
    daysOfWeek: [1,2,3,4,5],
  })

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const slotsInWeek = slots.filter(s => {
    const d = parseISO(s.starts_at)
    return d >= weekStart && d < addDays(weekStart, 7)
  })

  const getSlotForCell = (day, hour) =>
    slotsInWeek.filter(s => {
      const d = parseISO(s.starts_at)
      return isSameDay(d, day) && d.getHours() === hour
    })

  const handleSync = async () => {
    setSyncing(true)
    try {
      await syncGCal({ workspaceId: workspace.id })
      await refetch()
    } catch {}
    setSyncing(false)
  }

  const toggleDay = (d) => setWindowForm(w => ({
    ...w,
    daysOfWeek: w.daysOfWeek.includes(d) ? w.daysOfWeek.filter(x => x !== d) : [...w.daysOfWeek, d].sort()
  }))

  const handleGenerate = async () => {
    setGenerating(true); setGenResult(null)
    try {
      const res = await generateSlots({ workspaceId: workspace.id, ...windowForm, studyId: windowForm.studyId || null })
      setGenResult(res.created || 0)
      await refetch()
      setTimeout(() => { setShowWindow(false); setGenResult(null) }, 1500)
    } catch (e) { alert(e.message) }
    setGenerating(false)
  }

  return (
    <div className="p-8 max-w-6xl">
      <PageHeader
        title="Calendar"
        description="Manage availability and upcoming sessions"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
              <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', syncing && 'animate-spin')} />
              Sync Google Cal
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowWindow(true)}>
              <CalendarPlus className="h-3.5 w-3.5 mr-1.5" /> Set availability
            </Button>
            <div className="flex rounded-md border overflow-hidden">
              <button onClick={() => setView('week')} className={cn('px-3 py-1.5 text-xs flex items-center gap-1.5', view === 'week' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
                <LayoutGrid className="h-3.5 w-3.5" /> Week
              </button>
              <button onClick={() => setView('list')} className={cn('px-3 py-1.5 text-xs flex items-center gap-1.5', view === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
                <List className="h-3.5 w-3.5" /> List
              </button>
            </div>
          </div>
        }
      />

      {/* Week navigation */}
      {view === 'week' && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart(d => addDays(d, -7))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[200px] text-center">
              {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart(d => addDays(d, 7))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
              Today
            </Button>
          </div>

          {/* Week grid */}
          <Card className="shadow-none overflow-hidden">
            <div className="overflow-auto">
              <div className="min-w-[700px]">
                {/* Day headers */}
                <div className="grid grid-cols-8 border-b">
                  <div className="p-2" />
                  {weekDays.map(day => (
                    <div key={day.toISOString()} className={cn('p-2 text-center border-l', isToday(day) && 'bg-brand-50')}>
                      <div className="text-xs text-muted-foreground">{format(day, 'EEE')}</div>
                      <div className={cn('text-sm font-medium mt-0.5', isToday(day) && 'text-brand-600')}>{format(day, 'd')}</div>
                    </div>
                  ))}
                </div>

                {/* Time rows */}
                {HOURS.map(hour => (
                  <div key={hour} className="grid grid-cols-8 border-b last:border-0 min-h-[48px]">
                    <div className="p-2 text-xs text-muted-foreground text-right pr-3 pt-1.5 border-r">
                      {hour}:00
                    </div>
                    {weekDays.map(day => {
                      const cellSlots = getSlotForCell(day, hour)
                      return (
                        <div key={day.toISOString()} className={cn('border-l p-0.5 relative', isToday(day) && 'bg-brand-50/30')}>
                          {cellSlots.map(slot => (
                            <div
                              key={slot.id}
                              onClick={() => slot.participant_id && navigate(`/studies/${slot.study_id}/participants/${slot.participant_id}`)}
                              className={cn(
                                'rounded px-1.5 py-1 text-xs cursor-pointer mb-0.5',
                                slot.is_gcal_block
                                  ? 'bg-gray-200 text-gray-600 cursor-not-allowed'
                                  : slot.available
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                  : 'bg-brand-100 text-brand-700 hover:bg-brand-200'
                              )}
                            >
                              {slot.is_gcal_block
                                ? 'Busy'
                                : slot.available
                                ? `${format(parseISO(slot.starts_at), 'HH:mm')} — open`
                                : slot.participants?.name || 'Booked'
                              }
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </>
      )}

      {/* List view */}
      {view === 'list' && (
        <Card className="shadow-none">
          <CardContent className="p-0">
            {loading ? (
              <p className="text-sm text-muted-foreground p-6">Loading…</p>
            ) : slots.filter(s => !s.is_gcal_block).length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground mb-3">No slots yet.</p>
                <Button size="sm" onClick={() => setShowWindow(true)}>
                  <CalendarPlus className="h-4 w-4 mr-1.5" /> Set availability window
                </Button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4 text-xs font-medium text-muted-foreground">Date & time</th>
                    <th className="text-left p-4 text-xs font-medium text-muted-foreground">Duration</th>
                    <th className="text-left p-4 text-xs font-medium text-muted-foreground">Participant</th>
                    <th className="text-left p-4 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="p-4" />
                  </tr>
                </thead>
                <tbody>
                  {slots.filter(s => !s.is_gcal_block).map(s => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <div className="font-medium">{format(parseISO(s.starts_at), 'EEE, MMM d')}</div>
                        <div className="text-xs text-muted-foreground">{format(parseISO(s.starts_at), 'HH:mm')} – {format(parseISO(s.ends_at), 'HH:mm')}</div>
                      </td>
                      <td className="p-4 text-muted-foreground">{s.duration_minutes} min</td>
                      <td className="p-4">
                        {s.participant_id
                          ? <button className="text-brand-600 hover:underline font-medium" onClick={() => navigate(`/studies/${s.study_id}/participants/${s.participant_id}`)}>
                              {s.participants?.name || 'Unknown'}
                            </button>
                          : <span className="text-muted-foreground">—</span>
                        }
                      </td>
                      <td className="p-4">
                        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border',
                          s.available ? 'bg-green-100 text-green-700 border-green-200' : 'bg-blue-100 text-blue-700 border-blue-200'
                        )}>
                          {s.available ? 'Available' : 'Booked'}
                        </span>
                      </td>
                      <td className="p-4">
                        {s.available && (
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-destructive" onClick={() => removeSlot(s.id)}>
                            Remove
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Availability window modal */}
      <Dialog open={showWindow} onOpenChange={setShowWindow}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Set availability window</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Study (optional)</Label>
              <Select value={windowForm.studyId} onValueChange={v => setWindowForm(f => ({ ...f, studyId: v }))}>
                <SelectTrigger><SelectValue placeholder="All studies / global" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All studies</SelectItem>
                  {studies.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>From date</Label>
                <Input type="date" value={windowForm.dateFrom} onChange={e => setWindowForm(f => ({ ...f, dateFrom: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>To date</Label>
                <Input type="date" value={windowForm.dateTo} onChange={e => setWindowForm(f => ({ ...f, dateTo: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start time</Label>
                <Input type="time" value={windowForm.timeFrom} onChange={e => setWindowForm(f => ({ ...f, timeFrom: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>End time</Label>
                <Input type="time" value={windowForm.timeTo} onChange={e => setWindowForm(f => ({ ...f, timeTo: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Slot duration</Label>
                <Select value={String(windowForm.durationMinutes)} onValueChange={v => setWindowForm(f => ({ ...f, durationMinutes: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[20,30,45,60,75,90,120].map(m => <SelectItem key={m} value={String(m)}>{m} min</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Buffer between slots</Label>
                <Select value={String(windowForm.bufferMinutes)} onValueChange={v => setWindowForm(f => ({ ...f, bufferMinutes: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[0,5,10,15,20,30].map(m => <SelectItem key={m} value={String(m)}>{m === 0 ? 'None' : `${m} min`}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Days of week</Label>
              <div className="flex gap-1.5">
                {DAYS.map((d, i) => (
                  <button key={i} type="button" onClick={() => toggleDay(i)}
                    className={cn('px-2.5 py-1 rounded text-xs font-medium border transition-colors',
                      windowForm.daysOfWeek.includes(i) ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-muted'
                    )}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            {genResult !== null && (
              <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
                ✓ {genResult} slots created successfully
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWindow(false)}>Cancel</Button>
            <Button onClick={handleGenerate} disabled={generating || !windowForm.dateFrom || !windowForm.dateTo || !windowForm.daysOfWeek.length}>
              {generating ? 'Generating…' : 'Generate slots'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
