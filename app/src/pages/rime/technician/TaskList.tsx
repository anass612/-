import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { useLanguage } from '../../../i18n/LanguageContext'
import type { Client, Task } from '../../../lib/types'
import { EmptyState, Mono, Spinner } from '../../../components/rime/primitives'

const TYPE_TONE: Record<string, { bg: string; text: string }> = {
  installation: { bg: 'var(--surface-selected)', text: 'var(--color-primary)' },
  battery_replacement: { bg: 'var(--warning-bg)', text: 'var(--warning-text)' },
  maintenance: { bg: 'var(--info-bg)', text: 'var(--info-text)' },
  retrieval: { bg: 'var(--critical-bg)', text: 'var(--critical-text)' },
  inspection: { bg: 'var(--info-bg)', text: 'var(--info-text)' },
}

export function TaskList() {
  const { profile } = useAuth()
  const { t } = useLanguage()
  const [tasks, setTasks] = useState<Task[]>([])
  const [clients, setClients] = useState<Record<string, Client>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!profile) return
      const { data } = await supabase.from('tasks').select('*').eq('assigned_to', profile.id).neq('status', 'cancelled').neq('status', 'completed').order('scheduled_date', { ascending: true })
      setTasks((data as Task[]) ?? [])
      const ids = [...new Set((data as Task[] | null)?.map((tk) => tk.branch_id))] as string[]
      if (ids.length) {
        const { data: cl } = await supabase.from('clients').select('*').in('id', ids)
        setClients(Object.fromEntries(((cl as Client[]) ?? []).map((c) => [c.id, c])))
      }
      setLoading(false)
    }
    load()
  }, [profile])

  const initials = (profile?.full_name ?? '?').split(' ').map((p) => p[0]).slice(0, 2).join('')

  if (loading) return <Spinner />

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', padding: '16px 18px' }}>
      <div className="flex items-center justify-between" style={{ paddingBottom: 14, borderBottom: '1px solid var(--border-color)' }}>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center font-semibold" style={{ width: 34, height: 34, borderRadius: 999, background: 'var(--avatar-bg)', fontSize: 13 }}>{initials}</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{profile?.full_name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{profile?.role}</div>
          </div>
        </div>
        <span
          className="font-semibold"
          style={{ padding: '5px 12px', borderRadius: 999, background: 'var(--surface-selected)', border: '1px solid var(--color-primary)', color: 'var(--color-primary)', fontSize: 13 }}
        >
          {t.technician.tasksToday(tasks.length)}
        </span>
      </div>

      <div className="mt-4 space-y-2.5">
        {tasks.length === 0 ? <EmptyState message={t.common.noData} /> : tasks.map((task) => {
          const tone = TYPE_TONE[task.task_type] ?? TYPE_TONE.maintenance
          const client = clients[task.branch_id]
          return (
            <Link key={task.id} to={`/tasks/${task.id}`}>
              <div style={{ background: 'var(--surface-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--rime-radius-md)', padding: '14px 16px' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold" style={{ fontSize: 12, padding: '2px 10px', borderRadius: 999, background: tone.bg, color: tone.text }}>
                    {t.technician.taskType[task.task_type]}
                  </span>
                  {task.scheduled_date && <Mono style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{task.scheduled_date}</Mono>}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{client?.branch_name}</div>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{task.checklist ?? client?.client_name}</p>
                {client?.branch_address && (
                  <div className="flex items-center gap-1 mt-1.5" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    <MapPin size={13} /> {client.branch_address}
                  </div>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
