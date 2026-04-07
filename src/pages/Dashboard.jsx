import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '@/context/AppContext'
import { useStudies } from '@/hooks/useStudies'
import { useParticipants } from '@/hooks/useParticipants'
import { useSlots } from '@/hooks/useSlots'
import { format, startOfWeek, subWeeks, isSameDay, parseISO, isToday } from 'date-fns'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import StatusBadge from '@/components/ui/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime } from '@/lib/utils'
import { Plus, ArrowRight, Video, Users, CalendarDays, CheckCircle2, Clock, UserX } from 'lucide-react'

const PRIMARY = 'oklch(0.795 0.162 86)'
const PRIMARY_LIGHT = 'oklch(0.795 0.162 86 / 0.15)'

export default function Dashboard() {
  useEffect(() => { document.title = 'Dashboard | InterviewOS' }, [])
  const { user, workspace } = useApp()
  const { studies, loading: sLoading } = useStudies()
  const { participants, loading: pLoading } = useParticipants()
  const { slots } = useSlots()
  const navigate = useNavigate()

  const total     = participants.length
  const completed = participants.filter(p => p.status === 'completed' || p.status === 'prize-granted').length
  const booked    = participants.filter(p => p.status === 'booked').length
  const noShow    = participants.filter(p => p.status === 'no-show').length
  const disq      = participants.filter(p => p.status === 'disqualified').length

  const upcoming = slots
    .filter(s => s.available === false && s.participant_id && new Date(s.starts_at) > new Date())
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
    .slice(0, 8)

  const todayCount = slots.filter(s =>
    s.available === false && s.participant_id && isToday(parseISO(s.starts_at))
  ).length

  const next7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    d.setHours(0, 0, 0, 0)
    return d
  })

  const weeklyData = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 8 }, (_, i) => {
      const weekStart = startOfWeek(subWeeks(now, 7 - i), { weekStartsOn: 1 })
      const weekEnd = new Date(weekStart.getTime() + 7 * 86400000)
      const count = participants.filter(p => {
        const d = new Date(p.created_at)
        return d >= weekStart && d < weekEnd
      }).length
      return { week: format(weekStart, 'MMM d'), count }
    })
  }, [participants])

  const pipelineData = [
    { name: 'Completed', value: completed, color: '#22c55e' },
    { name: 'Booked',    value: booked,    color: '#3b82f6' },
    { name: 'No-show',   value: noShow,    color: '#ef4444' },
    { name: 'Disqualified', value: disq,   color: '#f97316' },
    { name: 'Other',     value: Math.max(0, total - completed - booked - noShow - disq), color: '#e5e7eb' },
  ].filter(d => d.value > 0)

  const studyData = useMemo(() => studies.slice(0, 6).map(s => {
    const ps   = participants.filter(p => p.study_id === s.id)
    const done = ps.filter(p => p.status === 'completed' || p.status === 'prize-granted').length
    const pct  = s.target_count ? Math.round((done / s.target_count) * 100) : 0
    const status = done >= (s.target_count || 0) && s.target_count > 0 ? 'full'
      : ps.length === 0 ? 'draft' : 'active'
    return { id: s.id, name: s.name, done, target: s.target_count || 0, pct, status }
  }), [studies, participants])

  const name = user?.user_metadata?.given_name || user?.email?.split('@')[0] || 'there'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const nudge = todayCount > 0
    ? `${todayCount} session${todayCount > 1 ? 's' : ''} on your calendar today`
    : booked > 0
    ? `${booked} participant${booked > 1 ? 's' : ''} waiting to be scheduled`
    : studies.length > 0 ? 'All clear — nothing scheduled today'
    : 'Ready when you are — create your first study'

  return (
    <div className="p-8 space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between animate-fade-up" style={{ animationDelay: '0ms' }}>
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight text-foreground">{greeting}, {name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{workspace?.name} · {nudge}</p>
        </div>
        <Button onClick={() => navigate('/studies')}>
          <Plus className="h-4 w-4 mr-1.5" /> New study
        </Button>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total participants', value: total,     bg: 'bg-background',  border: 'border', text: 'text-foreground',  icon: Users,        iconColor: 'text-muted-foreground' },
          { label: 'Completed',          value: completed, bg: 'bg-emerald-50',  border: 'border-emerald-100', text: 'text-emerald-700', icon: CheckCircle2, iconColor: 'text-emerald-500' },
          { label: 'Booked',             value: booked,    bg: 'bg-sky-50',      border: 'border-sky-100',     text: 'text-sky-700',    icon: Clock,        iconColor: 'text-sky-500' },
          { label: 'No-shows',           value: noShow,    bg: 'bg-rose-50',     border: 'border-rose-100',    text: 'text-rose-600',   icon: UserX,        iconColor: 'text-rose-400' },
        ].map((s, i) => (
          <Card key={s.label} className={`shadow-none animate-fade-up ${s.bg} ${s.border}`} style={{ animationDelay: `${80 + i * 70}ms` }}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground">{s.label}</span>
                <s.icon className={`h-4 w-4 ${s.iconColor}`} />
              </div>
              {pLoading
                ? <Skeleton className="h-8 w-12" />
                : <div className={`text-3xl font-bold tabular-nums ${s.text}`}>{s.value}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-2 gap-4 animate-fade-up" style={{ animationDelay: '380ms' }}>

        {/* Donut — pipeline */}
        <Card className="col-span-1 shadow-none">
          <CardHeader className="pb-1">
            <CardTitle>Participant pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            {pLoading ? <Skeleton className="h-44 w-full" /> : total === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center gap-3">
                <p className="text-sm text-muted-foreground text-center">No participants yet.<br/>Start by creating a study.</p>
                <Button size="sm" onClick={() => navigate('/studies')}><Plus className="h-3.5 w-3.5 mr-1" /> Create study</Button>
              </div>
            ) : (
              <div className="flex items-center gap-5">
                <div className="shrink-0">
                  <ResponsiveContainer width={140} height={140}>
                    <PieChart>
                      <Pie data={pipelineData} cx="50%" cy="50%" innerRadius={42} outerRadius={65} dataKey="value" strokeWidth={2} stroke="var(--card)">
                        {pipelineData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid var(--border)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 flex-1 min-w-0">
                  {pipelineData.map(d => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                        <span className="text-muted-foreground truncate">{d.name}</span>
                      </div>
                      <span className="font-semibold tabular-nums ml-2">{d.value}</span>
                    </div>
                  ))}
                  <div className="pt-1 border-t text-xs text-muted-foreground flex justify-between">
                    <span>Total</span>
                    <span className="font-semibold text-foreground">{total}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Area — weekly signups */}
        <Card className="col-span-1 shadow-none">
          <CardHeader className="pb-1">
            <CardTitle>Weekly signups</CardTitle>
          </CardHeader>
          <CardContent>
            {pLoading ? <Skeleton className="h-44 w-full" /> : (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={weeklyData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={PRIMARY} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={PRIMARY} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid var(--border)' }} />
                  <Area type="monotone" dataKey="count" name="Signups" stroke={PRIMARY} strokeWidth={2} fill="url(#areaGrad)" dot={{ r: 3, fill: PRIMARY, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

      </div>

      {/* ── Bottom row ── */}
      <div className="grid grid-cols-5 gap-4 animate-fade-up" style={{ animationDelay: '520ms' }}>

        {/* Upcoming sessions + day strip */}
        <Card className="col-span-3 shadow-none">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle>Upcoming sessions</CardTitle>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => navigate('/calendar')}>
                Calendar <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {/* Day strip */}
            <div className="flex gap-1 mb-4">
              {next7.map((day, i) => {
                const daySlots = slots.filter(s =>
                  s.available === false && s.participant_id &&
                  isSameDay(parseISO(s.starts_at), day)
                )
                const today_ = i === 0
                return (
                  <div key={i} className={`flex-1 flex flex-col items-center py-2.5 rounded-lg transition-all duration-200 ${today_ ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted/40 hover:bg-muted hover:-translate-y-px'}`}>
                    <span className={`text-[10px] font-medium uppercase tracking-wide ${today_ ? 'opacity-75' : 'text-muted-foreground'}`}>{format(day, 'EEE')}</span>
                    <span className={`text-base font-bold mt-0.5 ${today_ ? '' : 'text-foreground'}`}>{format(day, 'd')}</span>
                    <span className={`mt-1.5 text-[10px] font-semibold min-w-[16px] text-center ${daySlots.length > 0 ? (today_ ? 'opacity-90' : 'text-primary') : 'opacity-0'}`}>
                      {daySlots.length > 0 ? daySlots.length : '·'}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Session list */}
            {upcoming.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <CalendarDays className="h-8 w-8 text-muted-foreground/30 animate-float" />
                <p className="text-sm text-muted-foreground">Your schedule is clear — enjoy the calm</p>
                <Button variant="outline" size="sm" onClick={() => navigate('/calendar')}>Set availability</Button>
              </div>
            ) : (
              <div className="space-y-px">
                {upcoming.map(slot => (
                  <div key={slot.id} className="flex items-center justify-between py-2.5 border-b last:border-0 rounded-sm transition-colors hover:bg-muted/30 px-1 -mx-1">
                    <div>
                      <div className="text-sm font-medium">{slot.participants?.name || 'Unknown'}</div>
                      <div className="text-xs text-muted-foreground">{formatDateTime(slot.starts_at)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={slot.participants?.status || 'booked'} />
                      {slot.meet_link && (
                        <a href={slot.meet_link} target="_blank" rel="noreferrer">
                          <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                            <Video className="h-3 w-3" /> Join
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Studies */}
        <Card className="col-span-2 shadow-none">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle>Studies</CardTitle>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => navigate('/studies')}>
                View all <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {sLoading ? (
              <div className="space-y-4">
                {[1,2,3].map(i => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-1.5 w-full" />
                  </div>
                ))}
              </div>
            ) : studyData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <p className="text-sm text-muted-foreground text-center">Nothing here yet.<br/>Create a study to start recruiting.</p>
                <Button size="sm" onClick={() => navigate('/studies')}><Plus className="h-3.5 w-3.5 mr-1" /> Create study</Button>
              </div>
            ) : (
              <div className="space-y-4">
                {studyData.map(s => (
                  <div key={s.id} className="cursor-pointer group rounded-md transition-colors hover:bg-muted/30 -mx-2 px-2 py-1" onClick={() => navigate(`/studies/${s.id}`)}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium truncate flex-1 group-hover:text-primary transition-colors">{s.name}</span>
                      <div className="flex items-center gap-1.5 ml-2 shrink-0">
                        <span className="text-xs text-muted-foreground tabular-nums">{s.done}/{s.target}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${
                          s.status === 'full'   ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          s.status === 'draft'  ? 'bg-muted text-muted-foreground border-border' :
                                                  'bg-sky-50 text-sky-700 border-sky-200'
                        }`}>
                          {s.status === 'full' ? 'Full' : s.status === 'draft' ? 'Draft' : 'Active'}
                        </span>
                      </div>
                    </div>
                    <Progress value={s.pct} className="h-1.5" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
