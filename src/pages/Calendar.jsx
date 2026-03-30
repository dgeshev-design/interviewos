import { useState } from 'react'
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
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { addDays, addMonths, startOfWeek, endOfMonth, startOfMonth, format, isSameDay, parseISO, isToday } from 'date-fns'
import { ChevronLeft, ChevronRight, RefreshCw, CalendarPlus, List, LayoutGrid, Trash2, Plus } from 'lucide-react'

const HOURS       = Array.from({ length: 16 }, (_, i) => i + 7) // 7–22
const DAYS        = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const HOUR_PX     = 56   // px per hour in week grid
const GRID_START  = 7    // first hour shown

const fmtDate = (d) => format(d, 'yyyy-MM-dd')

export default function Calendar() {
  const { workspace } = useApp()
  const { slots, loading, addSlot, removeSlot, removeSlots, refetch } = useSlots()
  const { studies } = useStudies()
  const navigate    = useNavigate()
  const { toast }   = useToast()

  const [view, setView]             = useState('week')
  const [weekStart, setWeekStart]   = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [showWindow, setShowWindow] = useState(false)
  const [syncing, setSyncing]       = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genResult, setGenResult]   = useState(null)
  const [selected, setSelected]     = useState(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // Quick-add slot via week grid click
  const [showAddSlot, setShowAddSlot]   = useState(false)
  const [addSlotCell, setAddSlotCell]   = useState(null) // { day: Date, hour: number }
  const [addSlotDur, setAddSlotDur]     = useState('60')
  const [addSlotStudy, setAddSlotStudy] = useState('__all__')
  const [addingSlot, setAddingSlot]     = useState(false)

  const [windowForm, setWindowForm] = useState({
    studyId: '__all__',
    dateFrom: '',
    dateTo: '',
    timeFrom: '09:00',
    timeTo: '17:00',
    durationMinutes: '60',
    bufferMinutes: '15',
    daysOfWeek: [1,2,3,4,5],
  })

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const slotsInWeek = slots.filter(s => {
    const d = parseISO(s.starts_at)
    return d >= weekStart && d < addDays(weekStart, 7)
  })

const openSlots = slots.filter(s => s.available && !s.is_gcal_block)

  const handleSync = async () => {
    setSyncing(true)
    try {
      const result = await syncGCal({ workspaceId: workspace.id })
      if (result.error) toast({ title: 'Sync failed', description: result.error, variant: 'destructive' })
      else { toast({ title: 'Synced', description: `${result.synced} busy blocks imported`, variant: 'success' }); await refetch() }
    } catch (e) { toast({ title: 'Sync error', description: e.message, variant: 'destructive' }) }
    setSyncing(false)
  }

  const handleClearAll = async () => {
    if (!openSlots.length) return
    setBulkDeleting(true)
    try { await removeSlots(openSlots.map(s => s.id)); setSelected(new Set()) }
    catch (e) { toast({ title: 'Delete failed', description: e.message, variant: 'destructive' }) }
    setBulkDeleting(false)
  }

  const toggleDay = (d) => setWindowForm(w => ({
    ...w,
    daysOfWeek: w.daysOfWeek.includes(d) ? w.daysOfWeek.filter(x => x !== d) : [...w.daysOfWeek, d].sort()
  }))

  // Date presets for availability modal
  const today = new Date()
  const thisMonStart = startOfWeek(today, { weekStartsOn: 1 })
  const presets = [
    { label: 'This week',  from: fmtDate(today),                          to: fmtDate(addDays(thisMonStart, 6)) },
    { label: 'Next week',  from: fmtDate(addDays(thisMonStart, 7)),       to: fmtDate(addDays(thisMonStart, 13)) },
    { label: '2 weeks',    from: fmtDate(today),                          to: fmtDate(addDays(today, 13)) },
    { label: 'This month', from: fmtDate(today),                          to: fmtDate(endOfMonth(today)) },
    { label: 'Next month', from: fmtDate(startOfMonth(addMonths(today, 1))), to: fmtDate(endOfMonth(addMonths(today, 1))) },
  ]

  const handleGenerate = async () => {
    if (!windowForm.dateFrom || !windowForm.dateTo) {
      toast({ title: 'Missing dates', description: 'Please set a start and end date.', variant: 'destructive' })
      return
    }
    if (!windowForm.daysOfWeek.length) {
      toast({ title: 'Select at least one day', variant: 'destructive' })
      return
    }
    setGenerating(true); setGenResult(null)
    try {
      const dur = parseInt(windowForm.durationMinutes, 10) || 60
      const buf = parseInt(windowForm.bufferMinutes,   10) || 0
      const payload = {
        workspaceId:     workspace.id,
        studyId:         (windowForm.studyId && windowForm.studyId !== '__all__') ? windowForm.studyId : null,
        dateFrom:        windowForm.dateFrom,
        dateTo:          windowForm.dateTo,
        timeFrom:        windowForm.timeFrom,
        timeTo:          windowForm.timeTo,
        durationMinutes: dur,
        bufferMinutes:   buf,
        daysOfWeek:      windowForm.daysOfWeek,
        timezoneOffset:  new Date().getTimezoneOffset(),
      }
      const res = await generateSlots(payload)
      if (res.error) throw new Error(res.error)
      const count = res.created || 0
      setGenResult(count)
      toast({ title: `${count} slots created`, variant: 'success' })
      await refetch()
      setTimeout(() => { setShowWindow(false); setGenResult(null) }, 1200)
    } catch (e) {
      toast({ title: 'Failed to generate slots', description: e.message, variant: 'destructive' })
    }
    setGenerating(false)
  }

  const handleQuickAdd = async () => {
    if (!addSlotCell) return
    setAddingSlot(true)
    const start = new Date(addSlotCell.day)
    start.setHours(addSlotCell.hour, 0, 0, 0)
    try {
      await addSlot({
        starts_at:       start.toISOString(),
        duration_minutes: parseInt(addSlotDur, 10) || 60,
        study_id:        (addSlotStudy && addSlotStudy !== '__all__') ? addSlotStudy : null,
        meet_link:       '',
      })
      toast({ title: 'Slot added', variant: 'success' })
      setShowAddSlot(false)
    } catch (e) {
      toast({ title: 'Failed to add slot', description: e.message, variant: 'destructive' })
    }
    setAddingSlot(false)
  }

  const tzLabel = (() => { const off = -new Date().getTimezoneOffset() / 60; return `UTC${off >= 0 ? '+' : ''}${off}` })()

  return (
    <div className="p-8">
      <PageHeader
        title="Calendar"
        description="Manage your availability and upcoming sessions"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
              <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', syncing && 'animate-spin')} />
              {syncing ? 'Syncing…' : 'Sync Google Cal'}
            </Button>
            {openSlots.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleClearAll} disabled={bulkDeleting}
                className="text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                {bulkDeleting ? 'Clearing…' : `Clear all open (${openSlots.length})`}
              </Button>
            )}
            <Button size="sm" onClick={() => setShowWindow(true)}>
              <CalendarPlus className="h-3.5 w-3.5 mr-1.5" /> Set availability
            </Button>
            <div className="flex rounded-md border overflow-hidden text-xs">
              <button onClick={() => setView('week')} className={cn('px-3 py-1.5 flex items-center gap-1.5 transition-colors', view === 'week' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
                <LayoutGrid className="h-3.5 w-3.5" /> Week
              </button>
              <button onClick={() => setView('list')} className={cn('px-3 py-1.5 flex items-center gap-1.5 transition-colors', view === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
                <List className="h-3.5 w-3.5" /> List
              </button>
            </div>
          </div>
        }
      />

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
            <span className="ml-auto text-xs text-muted-foreground">Your time ({tzLabel}) · click empty cell to add a slot</span>
          </div>

          <Card className="shadow-none overflow-hidden">
            <div className="overflow-auto">
              <div className="min-w-[700px]">
                {/* Day header row */}
                <div className="flex border-b">
                  <div className="w-14 flex-shrink-0 border-r" />
                  {weekDays.map(day => (
                    <div key={day.toISOString()} className={cn('flex-1 p-2 text-center border-l', isToday(day) && 'bg-brand-50')}>
                      <div className="text-xs text-muted-foreground">{format(day, 'EEE')}</div>
                      <div className={cn('text-sm font-medium mt-0.5', isToday(day) && 'text-brand-600')}>{format(day, 'd')}</div>
                    </div>
                  ))}
                </div>

                {/* Time grid body */}
                <div className="flex" style={{ height: HOURS.length * HOUR_PX }}>
                  {/* Hour labels */}
                  <div className="w-14 flex-shrink-0 relative border-r">
                    {HOURS.map(h => (
                      <div key={h} style={{ position: 'absolute', top: (h - GRID_START) * HOUR_PX, height: HOUR_PX }}
                        className="w-full flex items-start justify-end pr-2 pt-1">
                        <span className="text-xs text-muted-foreground">{h}:00</span>
                      </div>
                    ))}
                  </div>

                  {/* Day columns */}
                  {weekDays.map(day => {
                    const daySlots = slotsInWeek.filter(s => isSameDay(parseISO(s.starts_at), day))
                    return (
                      <div key={day.toISOString()}
                        className={cn('flex-1 relative border-l', isToday(day) && 'bg-brand-50/30')}
                        style={{ height: HOURS.length * HOUR_PX }}
                      >
                        {/* Hour grid lines + click targets */}
                        {HOURS.map(h => (
                          <div key={h}
                            style={{ position: 'absolute', top: (h - GRID_START) * HOUR_PX, height: HOUR_PX, width: '100%' }}
                            className="border-b border-border/50 hover:bg-muted/30 cursor-pointer group transition-colors"
                            onClick={() => {
                              setAddSlotCell({ day, hour: h })
                              setAddSlotDur(windowForm.durationMinutes || '60')
                              setAddSlotStudy('__all__')
                              setShowAddSlot(true)
                            }}
                          >
                            <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Plus className="h-3 w-3 text-muted-foreground/50" />
                            </div>
                          </div>
                        ))}

                        {/* Slots — absolutely positioned by time and sized by duration */}
                        {daySlots.map(slot => {
                          const d    = parseISO(slot.starts_at)
                          const top  = (d.getHours() - GRID_START + d.getMinutes() / 60) * HOUR_PX
                          const h    = Math.max((slot.duration_minutes / 60) * HOUR_PX - 2, 18)
                          return (
                            <div
                              key={slot.id}
                              onClick={(e) => {
                                e.stopPropagation()
                                if (slot.is_gcal_block) return
                                if (slot.available) removeSlot(slot.id)
                                else if (slot.participant_id) navigate(`/studies/${slot.study_id}/participants/${slot.participant_id}`)
                              }}
                              title={slot.available ? 'Click to remove' : undefined}
                              style={{ position: 'absolute', top, height: h, left: 2, right: 2, zIndex: 1 }}
                              className={cn(
                                'rounded px-1.5 overflow-hidden text-xs flex flex-col justify-start pt-0.5',
                                slot.is_gcal_block
                                  ? 'bg-gray-100 text-gray-500 cursor-default border border-gray-200'
                                  : slot.available
                                  ? 'bg-green-100 text-green-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 cursor-pointer border border-green-200'
                                  : 'bg-brand-100 text-brand-700 hover:bg-brand-200 cursor-pointer border border-brand-200'
                              )}
                            >
                              <span className="font-medium leading-tight truncate">
                                {slot.is_gcal_block ? '● Busy' :
                                 slot.available     ? `${format(parseISO(slot.starts_at), 'HH:mm')} open` :
                                 `${format(parseISO(slot.starts_at), 'HH:mm')} ${slot.participants?.name || 'Booked'}`}
                              </span>
                              {h >= 32 && (
                                <span className="text-[10px] opacity-70 leading-tight">
                                  {slot.duration_minutes} min
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </Card>
          {/* Legend */}
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-green-100 border border-green-200" /> Open (click to remove)</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-brand-100 border border-brand-200" /> Booked</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-gray-100 border border-gray-200" /> Busy (Google Cal)</span>
          </div>
        </>
      )}

      {view === 'list' && (() => {
        const deletable = slots.filter(s => s.available && !s.is_gcal_block)
        const allSelected = deletable.length > 0 && deletable.every(s => selected.has(s.id))
        const toggleAll = () => {
          if (allSelected) setSelected(new Set())
          else setSelected(new Set(deletable.map(s => s.id)))
        }
        const toggle = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
        const handleBulkDelete = async () => {
          if (!selected.size) return
          setBulkDeleting(true)
          try { await removeSlots([...selected]); setSelected(new Set()) }
          catch (e) { toast({ title: 'Delete failed', description: e.message, variant: 'destructive' }) }
          setBulkDeleting(false)
        }
        return (
          <Card className="shadow-none">
            {selected.size > 0 && (
              <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-muted/40">
                <span className="text-sm text-muted-foreground">{selected.size} selected</span>
                <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={handleBulkDelete} disabled={bulkDeleting}>
                  {bulkDeleting ? 'Deleting…' : `Delete ${selected.size} slot${selected.size > 1 ? 's' : ''}`}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelected(new Set())}>Clear selection</Button>
              </div>
            )}
            <CardContent className="p-0">
              {loading ? <p className="text-sm text-muted-foreground p-6">Loading…</p> :
               slots.length === 0 ? (
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
                      <th className="p-4 w-8">
                        {deletable.length > 0 && (
                          <input type="checkbox" className="rounded" checked={allSelected} onChange={toggleAll} />
                        )}
                      </th>
                      <th className="text-left p-4 text-xs font-medium text-muted-foreground">Date & time</th>
                      <th className="text-left p-4 text-xs font-medium text-muted-foreground">Duration</th>
                      <th className="text-left p-4 text-xs font-medium text-muted-foreground">Participant / source</th>
                      <th className="text-left p-4 text-xs font-medium text-muted-foreground">Status</th>
                      <th className="p-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {slots.map(s => {
                      const canSelect = s.available && !s.is_gcal_block
                      const isSelected = selected.has(s.id)
                      return (
                        <tr key={s.id} className={cn('border-b last:border-0 transition-colors', isSelected ? 'bg-muted/50' : 'hover:bg-muted/30')}>
                          <td className="p-4 w-8">
                            {canSelect && (
                              <input type="checkbox" className="rounded" checked={isSelected} onChange={() => toggle(s.id)} />
                            )}
                          </td>
                          <td className="p-4">
                            <div className="font-medium">{format(parseISO(s.starts_at), 'EEE, MMM d')}</div>
                            <div className="text-xs text-muted-foreground">{format(parseISO(s.starts_at), 'HH:mm')} – {format(parseISO(s.ends_at), 'HH:mm')}</div>
                          </td>
                          <td className="p-4 text-muted-foreground">{s.duration_minutes} min</td>
                          <td className="p-4">
                            {s.is_gcal_block
                              ? <span className="text-xs text-gray-400 italic">Google Calendar</span>
                              : s.participant_id
                              ? <button className="text-brand-600 hover:underline font-medium" onClick={() => navigate(`/studies/${s.study_id}/participants/${s.participant_id}`)}>
                                  {s.participants?.name || 'Unknown'}
                                </button>
                              : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="p-4">
                            <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border',
                              s.is_gcal_block ? 'bg-gray-100 text-gray-500 border-gray-200'
                              : s.available ? 'bg-green-100 text-green-700 border-green-200'
                              : 'bg-blue-100 text-blue-700 border-blue-200')}>
                              {s.is_gcal_block ? 'Busy' : s.available ? 'Available' : 'Booked'}
                            </span>
                          </td>
                          <td className="p-4">
                            {canSelect && (
                              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-destructive" onClick={() => removeSlot(s.id)}>
                                Remove
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
               )}
            </CardContent>
          </Card>
        )
      })()}

      {/* Availability window modal */}
      <Dialog open={showWindow} onOpenChange={(v) => { try { setShowWindow(v); if (!v) setGenResult(null) } catch(e){} }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Set availability window</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Date presets */}
            <div className="space-y-1.5">
              <Label>Quick date range</Label>
              <div className="flex flex-wrap gap-1.5">
                {presets.map(p => (
                  <button key={p.label} type="button"
                    onClick={() => setWindowForm(f => ({ ...f, dateFrom: p.from, dateTo: p.to }))}
                    className={cn('px-2.5 py-1 rounded-md text-xs border transition-colors',
                      windowForm.dateFrom === p.from && windowForm.dateTo === p.to
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-input hover:bg-muted')}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>From date *</Label>
                <Input type="date" value={windowForm.dateFrom} onChange={e => setWindowForm(f => ({ ...f, dateFrom: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>To date *</Label>
                <Input type="date" value={windowForm.dateTo} onChange={e => setWindowForm(f => ({ ...f, dateTo: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Available from</Label>
                <Input type="time" value={windowForm.timeFrom} onChange={e => setWindowForm(f => ({ ...f, timeFrom: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Available until</Label>
                <Input type="time" value={windowForm.timeTo} onChange={e => setWindowForm(f => ({ ...f, timeTo: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Slot duration</Label>
                <Select value={String(windowForm.durationMinutes || '60')} onValueChange={v => setWindowForm(f => ({ ...f, durationMinutes: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['20','30','45','60','75','90','120'].map(m => <SelectItem key={m} value={m}>{m} min</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Buffer between slots</Label>
                <Select value={String(windowForm.bufferMinutes ?? '15')} onValueChange={v => setWindowForm(f => ({ ...f, bufferMinutes: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['0','5','10','15','20','30'].map(m => <SelectItem key={m} value={m}>{m === '0' ? 'None' : `${m} min`}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Study (optional)</Label>
              <Select value={windowForm.studyId || '__all__'} onValueChange={v => setWindowForm(f => ({ ...f, studyId: v === '__all__' ? '__all__' : v }))}>
                <SelectTrigger><SelectValue placeholder="All studies" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All studies</SelectItem>
                  {(studies || []).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Days of week</Label>
              <div className="flex gap-1.5">
                {DAYS.map((d, i) => (
                  <button key={i} type="button" onClick={() => toggleDay(i)}
                    className={cn('px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors',
                      windowForm.daysOfWeek.includes(i) ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-muted')}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            {/* Preview */}
            {windowForm.dateFrom && windowForm.dateTo && (
              <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2.5 text-sm text-blue-700">
                {genResult !== null
                  ? <span className="text-green-600 font-medium">✓ {genResult} slots created successfully</span>
                  : <>Will create <strong>{Number(windowForm.durationMinutes)} min</strong> slots from <strong>{windowForm.timeFrom}</strong> to <strong>{windowForm.timeTo}</strong>{Number(windowForm.bufferMinutes) > 0 ? `, ${windowForm.bufferMinutes}min buffer,` : ','} on selected days between {windowForm.dateFrom} and {windowForm.dateTo}.</>
                }
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowWindow(false); setGenResult(null) }}>Cancel</Button>
            <Button
              onClick={handleGenerate}
              disabled={generating || !windowForm.dateFrom || !windowForm.dateTo || windowForm.daysOfWeek.length === 0}
            >
              {generating ? 'Generating…' : 'Generate slots'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick-add single slot dialog */}
      <Dialog open={showAddSlot} onOpenChange={setShowAddSlot}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add slot</DialogTitle>
          </DialogHeader>
          {addSlotCell && (
            <div className="space-y-4 py-2">
              <div className="rounded-md bg-muted/50 px-4 py-3 text-sm font-medium">
                {format(addSlotCell.day, 'EEEE, MMMM d')} at {String(addSlotCell.hour).padStart(2,'0')}:00
              </div>
              <div className="space-y-1.5">
                <Label>Duration</Label>
                <Select value={addSlotDur} onValueChange={setAddSlotDur}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['20','30','45','60','75','90','120'].map(m => <SelectItem key={m} value={m}>{m} min</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Study (optional)</Label>
                <Select value={addSlotStudy} onValueChange={setAddSlotStudy}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All studies</SelectItem>
                    {(studies || []).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSlot(false)}>Cancel</Button>
            <Button onClick={handleQuickAdd} disabled={addingSlot}>
              {addingSlot ? 'Adding…' : 'Add slot'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
