import { useNavigate } from 'react-router-dom'
import { useApp } from '@/context/AppContext'
import { useStudies } from '@/hooks/useStudies'
import { useParticipants } from '@/hooks/useParticipants'
import { useSlots } from '@/hooks/useSlots'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import StatusBadge from '@/components/ui/status-badge'
import PageHeader from '@/components/layout/PageHeader'
import { formatDateTime } from '@/lib/utils'
import { Plus, ArrowRight, Video } from 'lucide-react'

export default function Dashboard() {
  const { user, workspace } = useApp()
  const { studies, loading: sLoading } = useStudies()
  const { participants, loading: pLoading } = useParticipants()
  const { slots } = useSlots()
  const navigate = useNavigate()

  const total     = participants.length
  const completed = participants.filter(p => p.status === 'completed' || p.status === 'prize-granted').length
  const booked    = participants.filter(p => p.status === 'booked').length
  const noShow    = participants.filter(p => p.status === 'no-show').length

  const upcoming = slots
    .filter(s => s.available === false && s.participant_id && new Date(s.starts_at) > new Date())
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
    .slice(0, 5)

  const name = user?.user_metadata?.given_name || 'there'

  return (
    <div className="p-8">
      <PageHeader
        title={`Good ${new Date().getHours() < 12 ? 'morning' : 'afternoon'}, ${name}`}
        description={workspace?.name}
        actions={
          <Button size="sm" onClick={() => navigate('/studies')}>
            <Plus className="h-4 w-4 mr-1.5" /> New study
          </Button>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total participants', value: total, color: 'text-foreground' },
          { label: 'Completed',          value: completed, color: 'text-green-600' },
          { label: 'Booked',             value: booked,    color: 'text-blue-600'  },
          { label: 'No-shows',           value: noShow,    color: 'text-red-500'   },
        ].map(s => (
          <Card key={s.label} className="shadow-none">
            <CardContent className="p-5">
              <div className="text-xs text-muted-foreground mb-1">{s.label}</div>
              <div className={`text-2xl font-bold ${s.color}`}>{pLoading ? '—' : s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-4">
        {/* Upcoming sessions */}
        <div className="col-span-3">
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Upcoming sessions</CardTitle>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate('/calendar')}>
                  View calendar <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No upcoming sessions.</p>
              ) : (
                <div className="space-y-2">
                  {upcoming.map(slot => (
                    <div key={slot.id} className="flex items-center justify-between py-2 border-b last:border-0">
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
        </div>

        {/* Studies progress */}
        <div className="col-span-2">
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Studies</CardTitle>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate('/studies')}>
                  View all <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {sLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
               studies.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">No studies yet.</p> :
               <div className="space-y-3">
                {studies.slice(0, 5).map(s => {
                  const studyPs = participants.filter(p => p.study_id === s.id)
                  const done    = studyPs.filter(p => p.status === 'completed' || p.status === 'prize-granted').length
                  const pct     = s.target_count ? Math.round((done / s.target_count) * 100) : 0
                  return (
                    <div key={s.id} className="cursor-pointer" onClick={() => navigate(`/studies/${s.id}`)}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate flex-1">{s.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">{done}/{s.target_count}</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  )
                })}
               </div>
              }
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
