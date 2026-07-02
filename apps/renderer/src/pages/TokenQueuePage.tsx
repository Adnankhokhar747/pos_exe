import { useState } from 'react';
import { Box, Card, CardContent, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import type { Doctor, QueueStatus } from '../api/types';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TokenQueuePage(): JSX.Element {
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState(todayIso());

  const doctorsQuery = useQuery({
    queryKey: ['doctors-active'],
    queryFn: () => apiFetch<Doctor[]>('/api/v1/hospital/doctors'),
  });

  // Short 5s poll — this is the one screen meant to be glanced at continuously in a
  // waiting room, unlike the 60s license/module poll elsewhere.
  const queueQuery = useQuery({
    queryKey: ['hospital-queue', doctorId, date],
    queryFn: () => apiFetch<QueueStatus>(`/api/v1/hospital/queue?doctorId=${doctorId}&date=${date}`),
    enabled: Boolean(doctorId),
    refetchInterval: 5000,
  });

  const status = queueQuery.data;

  return (
    <Box p={2} height="100%" overflow="auto">
      <Typography variant="h6" gutterBottom>
        Token Queue
      </Typography>

      <Stack direction="row" spacing={2} mb={3}>
        <TextField select label="Doctor" value={doctorId} onChange={(e) => setDoctorId(e.target.value)} sx={{ minWidth: 220 }}>
          <MenuItem value="">Select a doctor</MenuItem>
          {(doctorsQuery.data ?? []).map((d) => (
            <MenuItem key={d.id} value={d.id}>
              {d.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField label="Date" type="date" InputLabelProps={{ shrink: true }} value={date} onChange={(e) => setDate(e.target.value)} />
      </Stack>

      {!doctorId && <Typography color="text.secondary">Select a doctor to view their queue.</Typography>}

      {doctorId && status && (
        <Stack direction="row" spacing={3} flexWrap="wrap">
          <Card sx={{ minWidth: 220, flex: '1 1 220px' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="overline" color="text.secondary">
                Current Token
              </Typography>
              <Typography variant="h1" sx={{ fontSize: 64, fontWeight: 700 }}>
                {status.currentToken || '—'}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ minWidth: 220, flex: '1 1 220px' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="overline" color="text.secondary">
                Next Token
              </Typography>
              <Typography variant="h1" sx={{ fontSize: 64, fontWeight: 700, color: 'primary.main' }}>
                {status.nextToken ?? '—'}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ minWidth: 220, flex: '1 1 220px' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="overline" color="text.secondary">
                Waiting Patients
              </Typography>
              <Typography variant="h3">{status.waitingCount}</Typography>
            </CardContent>
          </Card>
          <Card sx={{ minWidth: 220, flex: '1 1 220px' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="overline" color="text.secondary">
                Completed
              </Typography>
              <Typography variant="h3">{status.completedCount}</Typography>
            </CardContent>
          </Card>
        </Stack>
      )}
    </Box>
  );
}
