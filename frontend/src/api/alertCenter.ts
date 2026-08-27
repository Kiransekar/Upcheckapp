import apiClient from './client';
import type { PondContext } from './pondContext';

export type AlertSeverity = 'info' | 'watch' | 'critical';

export interface BriefingItem {
  pondId: string | null;
  topTitle: string;
  topSeverity: AlertSeverity;
  source: string;
  steps: string[];
  alertCount: number;
}

export const alertCenterApi = {
  /** Per-pond morning briefing (top action per pond) from unread alerts. */
  briefing: () => apiClient.get<BriefingItem[]>('/alert-center/briefing'),

  /**
   * The home screen in ONE request: the pond snapshots AND the alerts derived
   * from them.
   *
   * `live-briefing` computed a full context per active pond and threw the
   * contexts away; the screen then fetched the same contexts again per farm
   * for its biomass and logs figures. Same expensive work, twice, on every
   * visit. This returns both from one pass.
   */
  today: () =>
    apiClient.get<{ contexts: PondContext[]; briefing: BriefingItem[] }>(
      '/alert-center/today',
    ),

  /** Live briefing — engine alerts recomputed from each pond's latest data. */
  liveBriefing: () => apiClient.get<BriefingItem[]>('/alert-center/live-briefing'),

  /** Emit an alert into the unified stream. */
  emit: (body: {
    pondId?: string;
    farmId?: string;
    source: string;
    severity: AlertSeverity;
    title: string;
    body: string;
    steps?: string[];
  }) => apiClient.post('/alert-center/emit', body),
};
