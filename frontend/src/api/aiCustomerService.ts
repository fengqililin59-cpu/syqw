/**
 * @file AI客服监控面板 API
 */
import { getJson, putJson } from './client';

export interface AiCustomerServiceStats {
  mode: 'manual' | 'semi_auto' | 'full_auto';
  summary: {
    total_replies: number;
    auto_sent: number;
    manual_sent: number;
    auto_rate: number;
    active_threads: number;
    pending_drafts: number;
  };
  risk_distribution: {
    p0: number;
    p1: number;
    p2: number;
  };
  avg_confidence: number;
  daily_trend: Array<{
    date: string;
    total: number;
    auto_sent: number;
    manual: number;
  }>;
  days: number;
  tenant_settings: {
    inbox_auto_draft_enabled: boolean;
    inbox_ai_auto_send: boolean;
    inbox_ai_auto_send_pricing: boolean;
  };
}

export async function fetchAiCustomerServiceStats(days = 7): Promise<AiCustomerServiceStats> {
  return getJson<AiCustomerServiceStats>(`/ai-cs/stats?days=${days}`);
}

export async function updateAiCustomerServiceMode(mode: 'manual' | 'semi_auto' | 'full_auto') {
  const settings: Record<string, boolean> = {};
  if (mode === 'manual') {
    settings.inbox_auto_draft_enabled = false;
    settings.inbox_ai_auto_send = false;
    settings.inbox_ai_auto_send_pricing = false;
  } else if (mode === 'semi_auto') {
    settings.inbox_auto_draft_enabled = true;
    settings.inbox_ai_auto_send = true;
    settings.inbox_ai_auto_send_pricing = false;
  } else if (mode === 'full_auto') {
    settings.inbox_auto_draft_enabled = true;
    settings.inbox_ai_auto_send = true;
    settings.inbox_ai_auto_send_pricing = true;
  }
  return putJson('/settings/wework', settings);
}
