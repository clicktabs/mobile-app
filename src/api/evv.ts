import { apiRequest } from './client';
import type { EvvVisit } from '../types';

type EvvVisitsResponse = {
  success: boolean;
  visits: EvvVisit[];
  message?: string;
};

export function getEvvVisits(token: string, from?: string, to?: string) {
  return apiRequest<EvvVisitsResponse>('mobile/evv/visits', {
    token,
    query: { from, to },
  });
}

export function evvCheckin(
  token: string,
  scheduleId: number,
  body: {
    latitude: number;
    longitude: number;
    gps_accuracy?: number;
    verification_method?: string;
    device_id?: string;
  },
) {
  return apiRequest<{
    success: boolean;
    message?: string;
    evv_visit_id?: number;
    check_in_time?: string;
  }>(`mobile/evv/visits/${scheduleId}/checkin`, {
    method: 'POST',
    token,
    body,
  });
}

export function evvCheckout(
  token: string,
  scheduleId: number,
  body: {
    latitude: number;
    longitude: number;
    gps_accuracy?: number;
    notes?: string;
  },
) {
  return apiRequest<{
    success: boolean;
    message?: string;
    check_out_time?: string;
    duration_minutes?: number;
    compliance_issues?: unknown;
  }>(`mobile/evv/visits/${scheduleId}/checkout`, {
    method: 'POST',
    token,
    body,
  });
}
