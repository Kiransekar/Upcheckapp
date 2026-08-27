import apiClient from './client';
import type { PublicUser } from './farmMembers';

export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRequest {
    id: string;
    farmId: string;
    userId: string;
    startDate: string;
    endDate: string;
    reason: string | null;
    status: LeaveRequestStatus;
    decidedById: string | null;
    decidedAt: string | null;
    /** Loaded by the server — the pending queue used to render a raw uuid. */
    user?: PublicUser | null;
    createdAt: string;
}

export interface CreateLeaveRequestDto {
    id?: string;
    farmId: string;
    startDate: string;
    endDate: string;
    reason?: string;
}

export const leaveRequestsApi = {
    mine: (farmId: string) =>
        apiClient.get<LeaveRequest[]>('/leave-requests/mine', { params: { farmId } }),

    getAll: (farmId: string, status?: LeaveRequestStatus) =>
        apiClient.get<LeaveRequest[]>('/leave-requests', { params: { farmId, status } }),

    approve: (id: string) => apiClient.post<LeaveRequest>(`/leave-requests/${id}/approve`, {}),

    reject: (id: string) => apiClient.post<LeaveRequest>(`/leave-requests/${id}/reject`, {}),
};
