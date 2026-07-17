const BASE = (import.meta.env.VITE_API_BASE_URL as string) || '';

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('booking_token');
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.message ?? 'Request failed', data);
  return data as T;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export interface BookingDoctor {
  id: string;
  name: string;
  specialization: string | null;
  room_number: string | null;
  consultation_fee: string;
  max_daily_appointments: number;
  schedules: { day_of_week: string; start_time: string; end_time: string }[];
}

export interface DayAvailability {
  date: string;
  dayOfWeek: string;
  available: boolean;
  bookedCount: number;
  maxAppointments: number;
  nextToken: number | null;
}

export interface BookingAccount {
  id: string;
  name: string;
  email: string;
  patientId: string;
  tenantId: string;
}

export interface MyAppointment {
  id: string;
  appointmentDate: string;
  tokenNumber: number;
  appointmentType: string;
  status: string;
  bookedAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  notes: string | null;
  doctor: { id: string; name: string; specialization: string | null; roomNumber: string | null } | null;
}

export const api = {
  defaultTenant: () =>
    req<{ tenantId: string; name: string }>('/api/v1/booking/default-tenant'),

  doctors: (tenantId: string) =>
    req<BookingDoctor[]>(`/api/v1/booking/doctors?tenantId=${encodeURIComponent(tenantId)}`),

  availability: (doctorId: string, tenantId: string, from: string, to: string) =>
    req<DayAvailability[]>(
      `/api/v1/booking/doctors/${doctorId}/availability?tenantId=${encodeURIComponent(tenantId)}&from=${from}&to=${to}`,
    ),

  register: (tenantId: string, name: string, email: string, password: string, phone: string) =>
    req<{ token: string; account: BookingAccount }>('/api/v1/booking/auth/register', {
      method: 'POST',
      body: JSON.stringify({ tenantId, name, email, password, phone }),
    }),

  login: (tenantId: string, email: string, password: string) =>
    req<{ token: string; account: BookingAccount }>('/api/v1/booking/auth/login', {
      method: 'POST',
      body: JSON.stringify({ tenantId, email, password }),
    }),

  me: () => req<BookingAccount>('/api/v1/booking/auth/me'),

  book: (doctorId: string, appointmentDate: string, notes: string) =>
    req<{ id: string; doctorName: string; appointmentDate: string; tokenNumber: number; status: string }>(
      '/api/v1/booking/appointments',
      { method: 'POST', body: JSON.stringify({ doctorId, appointmentDate, notes }) },
    ),

  myAppointments: () => req<MyAppointment[]>('/api/v1/booking/appointments'),

  cancel: (id: string) =>
    req<{ message: string }>(`/api/v1/booking/appointments/${id}/cancel`, { method: 'POST' }),
};
