import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSlots } from '@/hooks/useSlots'
import { useStudies } from '@/hooks/useStudies'
import { useAvailabilityRule } from '@/hooks/useAvailabilityRule'
import { useApp } from '@/context/AppContext'
import { syncGCal } from '@/lib/api'
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
import { ChevronLeft, ChevronRight, RefreshCw, CalendarPlus, List, LayoutGrid } from 'lucide-react'

const HOURS      = Array.from({ length: 16 }, (_, i) => i + 7) // 7–22
const DAYS       = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const HOUR_PX    = 56
const GRID_START = 7

const fmtDate = (d) => format(d, 'yyyy-MM-dd')

export default function Calendar() {
  useEffect(() => { document.title = 'Calendar | InterviewOS' }, [])
  const { workspace } = useApp()
  const { slots, loading, removeSlot, removeSlots, refetch: refetchSlots } = useSlots()
  const { rule, saveRule } = useAvailabilityRule()
  const { studies } = useStudies()
  const navigate    = useNavigate()
  const { toast }   = useToast()

  const [view, setView]           = useState('week')
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [showWindow, setShowWindow] = useState(false)
  const [syncing, setSyncing]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [genResult, setGenResult] = useState(null)
  const [selected, setSelected]   = useState(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const [windowForm, setWindowForm] = useState({
    daysOfWeek:      rule?.days_of_week     || [1,2,3,4,5],
    timeFrom:        rule?.time_from         || '09:00',
    timeTo:          rule?.time_to           || '17:00',
    durationMinutes: String(rule?.duration_minutes || 60),
    bufferMinutes:   String(rule?.buffer_minutes   || 0),
  })

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  // Only booked sessions and GCal blocks in the slots table now
  const slotsInWeek = slots.filter(s => {
    const d = parseISO(s.starts_at)
    return d >= weekStart && d < addDays(weekStart, 7)
  })

  // Parse rule hours for the availability band, correcting for timezone drift.
  // rule.time_from is stored in admin's local time at save time; timezone_offset = UTC - local (minutes) at save time.
  // Convert through UTC → current local so the band stays correct across DST / TZ changes.
  const toCurrentLocal = (timeStr) => {
    if (!timeStr || !rule) return null
    const [h, m] = timeStr.split(':').map(Number)
    const savedTzOff   = parseInt(rule.timezone_offset || 0, 10) // UTC - saved-local (mins)
    const currentTzOff = new Date().getTimezoneOffset()           // UTC - current-local (mins)
    const utcMins  = h * 60 + m + savedTzOff
    const localMins = utcMins - currentTzOff
    return ((localMins % 1440) + 1440) % 1440 // wrap to 0-1439
  }
  const ruleBandStart = rule ? (() => {
    const mins = toCurrentLocal(rule.time_from)
    return (mins / 60 - GRID_START) * HOUR_PX
  })() : null
  const ruleBandEnd = rule ? (() => {
    const mins = toCurrentLocal(rule.time_to)
    return (mins / 60 - GRID_START) * HOUR_PX
  })() : null
  const ruleBandHeight = ruleBandStart !== null ? ruleBandEnd - ruleBandStart : 0

  const handleSync = async () => {
    setSyncing(true)
    try {
      const result = await syncGCal({ workspaceId: workspace.id })
      if (result.error) toast({ title: 'Sync failed', description: result.error, variant: 'destructive' })
      else { toast({ title: 'Synced', description: `${result.synced} busy blocks imported`, variant: 'success' }); await refetchSlots() }
    } catch (e) { toast({ title: 'Sync error', description: e.message, variant: 'destructive' }) }
    setSyncing(false)
  }

  const toggleDay = (d) => setWindowForm(w => ({
    ...w,
    daysOfWeek: w.daysOfWeek.includes(d) ? w.daysOfWeek.filter(x => x !== d) : [...w.daysOfWeek, d].sort()
  }))

  const handleSaveRule = async () => {
    if (!windowForm.daysOfWeek.length) {
      toast({ title: 'Select at least one day', variant: 'destructive' }); return
    }
    setSaving(true); setGenResult(null)
    try {
      const saved = await saveRule({
        daysOfWeek:      windowForm.daysOfWeek,
        timeFrom:        windowForm.timeFrom,
        timeTo:          windowForm.timeTo,
        durationMinutes: parseInt(windowForm.durationMinutes, 10) || 60,
        bufferMinutes:   parseInt(windowForm.bufferMinutes,   10) || 0,
        timezoneOffset:  new Date().getTimezoneOffset(),
      })
      if (saved?.error) throw new Error(saved.error)
      setGenResult('saved')
      toast({ title: 'Availability saved', variant: 'success' })
      setTimeout(() => { setShowWindow(false); setGenResult(null) }, 900)
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' })
    }
    setSaving(false)
  }

  // Open the modal and pre-fill with current rule values
  const openModal = () => {
    if (rule) {
      setWindowForm({
        daysOfWeek:      rule.days_of_week,
        timeFrom:        rule.time_from,
        timeTo:          rule.time_to,
        durationMinutes: String(rule.duration_minutes),
        bufferMinutes:   String(rule.buffer_minutes),
      })
    }
    setShowWindow(true)
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
            <Button size="sm" onClick={openModal}>
              <CalendarPlus className="h-3.5 w-3.5 mr-1.5" />
              {rule ? 'Edit availability' : 'Set availability'}
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

      {/* Rule summary badge */}
      {rule && (
        <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1 text-green-700 font-medium">
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
            Available {rule.time_from}–{rule.time_to} · {rule.duration_minutes} min slots · {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].filter((_,i) => rule.days_of_week.includes(i)).join(', ')}
          </span>
          <span className="text-muted-foreground">({tzLabel})</span>
        </div>
      )}

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

          <Card className="shadow-none overflow-hidden">
            <div className="overflow-auto">
              <div className="min-w-[700px]">
                {/* Day header */}
                <div className="flex border-b">
                  <div className="w-14 flex-shrink-0 border-r" />
                  {weekDays.map(day => (
                    <div key={day.toISOString()} className={cn('flex-1 p-2 text-center border-l', isToday(day) && 'bg-brand-50')}>
                      <div className="text-xs text-muted-foreground">{format(day, 'EEE')}</div>
                      <div className={cn('text-sm font-medium mt-0.5', isToday(day) && 'text-brand-600')}>{format(day, 'd')}</div>
                    </div>
                  ))}
                </div>

                {/* Grid body */}
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
                    const daySlots    = slotsInWeek.filter(s => isSameDay(parseISO(s.starts_at), day))
                    const isAvailDay  = rule?.days_of_week?.includes(day.getDay())
                    return (
                      <div key={day.toISOString()}
                        className={cn('flex-1 relative border-l', isToday(day) && 'bg-brand-50/20')}
                        style={{ height: HOURS.length * HOUR_PX }}
                      >
                        {/* Hour grid lines */}
                        {HOURS.map(h => (
                          <div key={h}
                            style={{ position: 'absolute', top: (h - GRID_START) * HOUR_PX, height: HOUR_PX, width: '100%' }}
                            className="border-b border-border/40"
                          />
                        ))}

                        {/* Availability band (green shading for the rule window) */}
                        {isAvailDay && ruleBandStart !== null && ruleBandHeight > 0 && (
                          <div style={{ position: 'absolute', top: ruleBandStart, height: ruleBandHeight, left: 0, right: 0, zIndex: 0 }}
                            className="bg-green-50/80 border-y border-green-100" />
                        )}

                        {/* Slots: GCal blocks + booked sessions */}
                        {daySlots.map(slot => {
                          const d    = parseISO(slot.starts_at)
                          const top  = (d.getHours() - GRID_START + d.getMinutes() / 60) * HOUR_PX
                          const h    = Math.max((slot.duration_minutes / 60) * HOUR_PX - 2, 18)
                          const pStatus = slot.participants?.status
                          const statusDot = { completed: '#10b981', 'prize-granted': '#8b5cf6', 'no-show': '#f59e0b', cancelled: '#ef4444' }[pStatus]
                          return (
                            <div
                              key={slot.id}
                              onClick={() => {
                                if (slot.is_gcal_block) return
                                if (slot.participant_id) navigate(`/studies/${slot.study_id}/participants/${slot.participant_id}`)
                              }}
                              style={{ position: 'absolute', top, height: h, left: 2, right: 2, zIndex: 1 }}
                              className={cn(
                                'rounded px-1.5 overflow-hidden text-xs flex flex-col justify-start pt-0.5',
                                slot.is_gcal_block
                                  ? 'bg-gray-100 text-gray-500 cursor-default border border-gray-200'
                                  : 'bg-brand-100 text-brand-700 hover:bg-brand-200 cursor-pointer border border-brand-200'
                              )}
                            >
                              <span className="font-medium leading-tight truncate flex items-center gap-1">
                                {slot.is_gcal_block ? '● Busy' : (
                                  <>
                                    {format(parseISO(slot.starts_at), 'HH:mm')} {slot.participants?.name || 'Booked'}
                                    {statusDot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusDot, flexShrink: 0, display: 'inline-block' }} />}
                                  </>
                                )}
                              </span>
                              {h >= 32 && (
                                <span className="text-[10px] opacity-70 leading-tight">{slot.duration_minutes} min</span>
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
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-green-50 border border-green-100" /> Available window</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-brand-100 border border-brand-200" /> Booked</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-gray-100 border border-gray-200" /> Busy (Google Cal)</span>
          </div>
        </>
      )}

      {view === 'list' && (() => {
        const bookedSlots = slots.filter(s => !s.is_gcal_block)
        const allSelected = bookedSlots.length > 0 && bookedSlots.every(s => selected.has(s.id))
        const toggleAll = () => {
          if (allSelected) setSelected(new Set())
          else setSelected(new Set(bookedSlots.map(s => s.id)))
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
                  {bulkDeleting ? 'Deleting…' : `Cancel ${selected.size} session${selected.size > 1 ? 's' : ''}`}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelected(new Set())}>Clear selection</Button>
              </div>
            )}
            <CardContent className="p-0">
              {loading ? <p className="text-sm text-muted-foreground p-6">Loading…</p> :
               slots.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-muted-foreground mb-1">No sessions yet.</p>
                  <p className="text-xs text-muted-foreground">{rule ? 'Sessions will appear here once participants book.' : 'Set your availability to start accepting bookings.'}</p>
                </div>
               ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="p-4 w-8">
                        {bookedSlots.length > 0 && (
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
                      const canSelect = !s.is_gcal_block
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
                            {s.is_gcal_block ? (
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border bg-gray-100 text-gray-500 border-gray-200">Busy</span>
                            ) : (() => {
                              const st = s.participants?.status || 'booked'
                              const cls = { booked: 'bg-blue-100 text-blue-700 border-blue-200', completed: 'bg-green-100 text-green-700 border-green-200', 'prize-granted': 'bg-purple-100 text-purple-700 border-purple-200', 'no-show': 'bg-amber-100 text-amber-700 border-amber-200', cancelled: 'bg-red-100 text-red-700 border-red-200', disqualified: 'bg-gray-100 text-gray-500 border-gray-200' }[st] || 'bg-blue-100 text-blue-700 border-blue-200'
                              return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border', cls)}>{st}</span>
                            })()}
                          </td>
                          <td className="p-4">
                            {canSelect && (
                              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-destructive" onClick={() => removeSlot(s.id)}>
                                Cancel
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

      {/* Set Availability modal */}
      <Dialog open={showWindow} onOpenChange={(v) => { try { setShowWindow(v); if (!v) setGenResult(null) } catch(e){} }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{rule ? 'Edit availability' : 'Set availability'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
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
                <Select value={String(windowForm.bufferMinutes ?? '0')} onValueChange={v => setWindowForm(f => ({ ...f, bufferMinutes: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['0','5','10','15','20','30'].map(m => <SelectItem key={m} value={m}>{m === '0' ? 'None' : `${m} min`}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
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
            <div className="rounded-md bg-muted/50 border px-3 py-2.5 text-sm text-muted-foreground">
              {genResult === 'saved'
                ? <span className="text-green-600 font-medium">✓ Availability saved</span>
                : <>Participants can book <strong>{windowForm.durationMinutes} min</strong> slots between <strong>{windowForm.timeFrom}</strong> and <strong>{windowForm.timeTo}</strong>{parseInt(windowForm.bufferMinutes) > 0 ? ` with ${windowForm.bufferMinutes} min buffer` : ''}, on selected days. GCal blocks and existing bookings are automatically excluded.</>
              }
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowWindow(false); setGenResult(null) }}>Cancel</Button>
            <Button onClick={handleSaveRule} disabled={saving || !windowForm.daysOfWeek.length}>
              {saving ? 'Saving…' : 'Save availability'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
