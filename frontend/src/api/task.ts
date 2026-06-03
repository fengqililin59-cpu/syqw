import { getJson, postJson, putJson, deleteJson } from './client';

export interface TaskItem {
  id: number;
  tenant_id: number;
  assignee_id: number | null;
  creator_id: number;
  customer_id: number | null;
  contract_id: number | null;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'todo' | 'in_progress' | 'done' | 'cancelled';
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  assignee?: { id: number; real_name: string; username: string; avatar_url: string | null };
  creator?: { id: number; real_name: string; username: string };
  customer?: { id: number; name: string };
  contract?: { id: number; title: string; contract_no: string };
}

export interface TaskStats {
  total: number;
  todo: number;
  overdue: number;
  today_due: number;
  done_today: number;
}

export async function fetchTasks(params: Record<string, any> = {}) {
  const qs = new URLSearchParams(params as any).toString();
  const res = await getJson<{ code: number; data: { items?: TaskItem[]; total?: number } | null }>(`/tasks?${qs}`);
  return {
    items: res.data?.items ?? [],
    total: res.data?.total ?? 0,
  };
}

export async function fetchMyTasks(params: Record<string, any> = {}) {
  const qs = new URLSearchParams(params as any).toString();
  const res = await getJson<{ code: number; data: any }>(`/tasks/my?${qs}`);
  return res.data!;
}

export async function fetchTask(id: number): Promise<TaskItem> {
  const res = await getJson<{ code: number; data: TaskItem }>(`/tasks/${id}`);
  return res.data!;
}

export async function createTask(data: Partial<TaskItem>): Promise<TaskItem> {
  const res = await postJson<{ code: number; data: TaskItem }>('/tasks', data);
  return res.data!;
}

export async function updateTask(id: number, data: Partial<TaskItem>): Promise<TaskItem> {
  const res = await putJson<{ code: number; data: TaskItem }>(`/tasks/${id}`, data);
  return res.data!;
}

export async function deleteTask(id: number): Promise<void> {
  await deleteJson(`/tasks/${id}`);
}

const EMPTY_TASK_STATS: TaskStats = { total: 0, todo: 0, overdue: 0, today_due: 0, done_today: 0 };

export async function fetchTaskStats(): Promise<TaskStats> {
  const data = await getJson<TaskStats | null>('/tasks/stats');
  if (!data || typeof data !== 'object') return { ...EMPTY_TASK_STATS };
  return {
    total: Number(data.total) || 0,
    todo: Number(data.todo) || 0,
    overdue: Number(data.overdue) || 0,
    today_due: Number(data.today_due) || 0,
    done_today: Number(data.done_today) || 0,
  };
}
