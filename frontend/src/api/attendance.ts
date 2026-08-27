import apiClient from './client';
import type { PublicUser } from './farmMembers';

export interface AttendanceRecord {
    id: string;
    farmId: string;
    userId: string;
    checkInAt: string;
    checkOutAt: string | null;
    /** Loaded by the server so every screen can show a name, not a uuid. */
    user?: PublicUser | null;
    createdAt: string;
}

export const attendanceApi = {
    /** Own attendance for a farm (optionally scoped to one YYYY-MM-DD day). */
    mine: (farmId: string, date?: string) =>
        apiClient.get<AttendanceRecord[]>('/attendance/mine', { params: { farmId, date } }),

    /**
     * Every member's attendance for a farm (owner/manager only).
     *
     * `date` is one day; `from`/`to` an inclusive day range. The month
     * calendar in AttendanceLogScreen needs the whole month in one call.
     */
    getAll: (farmId: string, date?: string, from?: string, to?: string) =>
        apiClient.get<AttendanceRecord[]>('/attendance', {
            params: { farmId, date, from, to },
        }),

    checkOut: (id: string) => apiClient.post<AttendanceRecord>(`/attendance/${id}/check-out`, {}),
};
