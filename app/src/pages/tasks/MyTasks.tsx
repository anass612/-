import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Client, Task } from '../../lib/types'
import { TASK_STATUS_LABELS, TASK_TYPE_LABELS } from '../../lib/types'
import { Card, EmptyState, PageHeader, Spinner } from '../../components/ui'

export function MyTasks() {
  const { profile } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [clients, setClients] = useState<Record<string, Client>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!profile) return
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', profile.id)
        .neq('status', 'cancelled')
        .order('scheduled_date', { ascending: true })
      setTasks((data as Task[]) ?? [])

      const ids = [...new Set((data as Task[] | null)?.map((t) => t.branch_id))] as string[]
      if (ids.length) {
        const { data: cl } = await supabase.from('clients').select('*').in('id', ids)
        setClients(Object.fromEntries(((cl as Client[]) ?? []).map((c) => [c.id, c])))
      }
      setLoading(false)
    }
    load()
  }, [profile])

  if (loading) return <Spinner />

  const pending = tasks.filter((t) => t.status !== 'completed')
  const completed = tasks.filter((t) => t.status === 'completed')

  return (
    <div>
      <PageHeader title="مهامي" />
      {pending.length === 0 ? <EmptyState message="لا توجد مهام حالياً" /> : (
        <div className="space-y-3 mb-8">
          {pending.map((t) => (
            <Link key={t.id} to={`/tasks/${t.id}`}>
              <Card className="hover:border-[var(--color-first-light)]">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{TASK_TYPE_LABELS[t.task_type]}</div>
                    <div className="text-sm text-[var(--color-ink-soft)]">
                      {clients[t.branch_id]?.client_name} — {clients[t.branch_id]?.branch_name}
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="text-xs text-[var(--color-ink-soft)]">{t.scheduled_date ?? 'بدون تاريخ'}</div>
                    <div className="text-xs font-medium mt-1">{TASK_STATUS_LABELS[t.status]}</div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <>
          <h2 className="text-sm label-mono text-[var(--color-ink-soft)] mb-3">مكتملة سابقاً</h2>
          <div className="space-y-2 opacity-70">
            {completed.slice(0, 10).map((t) => (
              <Card key={t.id}>
                <div className="text-sm">{TASK_TYPE_LABELS[t.task_type]} — {clients[t.branch_id]?.branch_name}</div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
