import React, { useState } from 'react';
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControl, InputLabel, MenuItem, Select, Stack, Tab, Tabs,
  TextField, Typography, Paper, IconButton, Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import WorkIcon from '@mui/icons-material/Work';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { HrJob, HrApplicant, HrJobStatus, HrApplicantStage } from '../api/types';

const STAGE_COLORS: Record<HrApplicantStage, 'default' | 'info' | 'warning' | 'success' | 'error' | 'primary'> = {
  applied:    'default',
  screening:  'info',
  interview:  'warning',
  offer:      'primary',
  hired:      'success',
  rejected:   'error',
};

const STATUS_COLORS: Record<HrJobStatus, 'success' | 'warning' | 'default'> = {
  open:    'success',
  on_hold: 'warning',
  closed:  'default',
};

function JobFormDialog({
  open, onClose, job,
}: { open: boolean; onClose: () => void; job?: HrJob | null }) {
  const qc = useQueryClient();
  const isEdit = !!job;
  const [form, setForm] = useState({
    title:         job?.title ?? '',
    department:    job?.department ?? '',
    description:   job?.description ?? '',
    requirements:  job?.requirements ?? '',
    positionsCount:String(job?.positionsCount ?? '1'),
    status:        job?.status ?? 'open' as HrJobStatus,
    deadline:      job?.deadline ?? '',
  });

  const mut = useMutation({
    mutationFn: () => isEdit
      ? apiFetch(`/api/v1/hr/recruitment/jobs/${job!.id}`, { method: 'PATCH', body: JSON.stringify({ ...form, positionsCount: +form.positionsCount }) })
      : apiFetch('/api/v1/hr/recruitment/jobs', { method: 'POST', body: JSON.stringify({ ...form, positionsCount: +form.positionsCount }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr-jobs'] }); onClose(); },
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? 'Edit Job' : 'Post New Job'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Job Title" required value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
          <TextField label="Department" value={form.department}
            onChange={e => setForm(p => ({ ...p, department: e.target.value }))} />
          <TextField label="Number of Positions" type="number" value={form.positionsCount}
            onChange={e => setForm(p => ({ ...p, positionsCount: e.target.value }))} />
          <TextField label="Application Deadline" type="date" InputLabelProps={{ shrink: true }}
            value={form.deadline} onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))} />
          <TextField label="Job Description" multiline rows={3} value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          <TextField label="Requirements" multiline rows={3} value={form.requirements}
            onChange={e => setForm(p => ({ ...p, requirements: e.target.value }))} />
          {isEdit && (
            <FormControl>
              <InputLabel>Status</InputLabel>
              <Select value={form.status} label="Status"
                onChange={e => setForm(p => ({ ...p, status: e.target.value as HrJobStatus }))}>
                <MenuItem value="open">Open</MenuItem>
                <MenuItem value="on_hold">On Hold</MenuItem>
                <MenuItem value="closed">Closed</MenuItem>
              </Select>
            </FormControl>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!form.title || mut.isPending} onClick={() => mut.mutate()}>
          {mut.isPending ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ApplicantFormDialog({
  open, onClose, jobId, applicant,
}: { open: boolean; onClose: () => void; jobId: string; applicant?: HrApplicant | null }) {
  const qc = useQueryClient();
  const isEdit = !!applicant;
  const [form, setForm] = useState({
    name:        applicant?.name ?? '',
    email:       applicant?.email ?? '',
    phone:       applicant?.phone ?? '',
    nationality: applicant?.nationality ?? '',
    cvNotes:     applicant?.cvNotes ?? '',
    notes:       applicant?.notes ?? '',
    stage:       applicant?.stage ?? 'applied' as HrApplicantStage,
    interviewDate:   applicant?.interviewDate ?? '',
    offeredSalary:   String(applicant?.offeredSalary ?? ''),
    rejectionReason: applicant?.rejectionReason ?? '',
  });

  const mut = useMutation({
    mutationFn: () => isEdit
      ? apiFetch(`/api/v1/hr/recruitment/applicants/${applicant!.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ ...form, offeredSalary: form.offeredSalary ? +form.offeredSalary : undefined }),
        })
      : apiFetch(`/api/v1/hr/recruitment/jobs/${jobId}/applicants`, {
          method: 'POST',
          body: JSON.stringify(form),
        }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hr-applicants', jobId] }); onClose(); },
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? 'Update Applicant' : 'Add Applicant'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Full Name" required value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          <TextField label="Email" type="email" value={form.email}
            onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
          <TextField label="Phone" value={form.phone}
            onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
          <TextField label="Nationality" value={form.nationality}
            onChange={e => setForm(p => ({ ...p, nationality: e.target.value }))} />
          <TextField label="CV / Notes / Resume Link" multiline rows={2} value={form.cvNotes}
            onChange={e => setForm(p => ({ ...p, cvNotes: e.target.value }))} />
          {isEdit && (
            <>
              <FormControl>
                <InputLabel>Stage</InputLabel>
                <Select value={form.stage} label="Stage"
                  onChange={e => setForm(p => ({ ...p, stage: e.target.value as HrApplicantStage }))}>
                  {(['applied','screening','interview','offer','hired','rejected'] as HrApplicantStage[]).map(s => (
                    <MenuItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              {form.stage === 'interview' && (
                <TextField label="Interview Date" type="date" InputLabelProps={{ shrink: true }}
                  value={form.interviewDate} onChange={e => setForm(p => ({ ...p, interviewDate: e.target.value }))} />
              )}
              {form.stage === 'offer' && (
                <TextField label="Offered Salary" type="number" value={form.offeredSalary}
                  onChange={e => setForm(p => ({ ...p, offeredSalary: e.target.value }))} />
              )}
              {form.stage === 'rejected' && (
                <TextField label="Rejection Reason" multiline rows={2} value={form.rejectionReason}
                  onChange={e => setForm(p => ({ ...p, rejectionReason: e.target.value }))} />
              )}
            </>
          )}
          <TextField label="Internal Notes" multiline rows={2} value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!form.name || mut.isPending} onClick={() => mut.mutate()}>
          {mut.isPending ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function HrRecruitmentPage() {
  const [selectedJob, setSelectedJob] = useState<HrJob | null>(null);
  const [jobDialog, setJobDialog]     = useState<{ open: boolean; job?: HrJob | null }>({ open: false });
  const [appDialog, setAppDialog]     = useState<{ open: boolean; applicant?: HrApplicant | null }>({ open: false });
  const [filterStage, setFilterStage] = useState<HrApplicantStage | ''>('');

  const { data: jobs = [] } = useQuery<HrJob[]>({
    queryKey: ['hr-jobs'],
    queryFn: () => apiFetch<HrJob[]>('/api/v1/hr/recruitment/jobs'),
  });

  const { data: applicants = [] } = useQuery<HrApplicant[]>({
    queryKey: ['hr-applicants', selectedJob?.id],
    queryFn: () => apiFetch<HrApplicant[]>(`/api/v1/hr/recruitment/jobs/${selectedJob!.id}/applicants`),
    enabled: !!selectedJob,
  });

  const filtered = filterStage ? applicants.filter(a => a.stage === filterStage) : applicants;

  const stageCounts = (Object.keys(STAGE_COLORS) as HrApplicantStage[]).reduce((acc, s) => {
    acc[s] = applicants.filter(a => a.stage === s).length;
    return acc;
  }, {} as Record<HrApplicantStage, number>);

  return (
    <Box sx={{ display: 'flex', height: '100%', gap: 2, p: 2 }}>
      {/* Job List */}
      <Paper sx={{ width: 300, flexShrink: 0, overflow: 'auto', p: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1, px: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold">Job Postings</Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={() => setJobDialog({ open: true, job: null })}>
            Post Job
          </Button>
        </Stack>
        <Divider sx={{ mb: 1 }} />
        {jobs.map(job => (
          <Paper
            key={job.id}
            variant="outlined"
            onClick={() => setSelectedJob(job)}
            sx={{
              p: 1.5, mb: 1, cursor: 'pointer',
              borderColor: selectedJob?.id === job.id ? 'primary.main' : undefined,
              bgcolor: selectedJob?.id === job.id ? 'action.selected' : undefined,
            }}
          >
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
              <Box>
                <Typography variant="body2" fontWeight="bold" noWrap>{job.title}</Typography>
                {job.department && <Typography variant="caption" color="text.secondary">{job.department}</Typography>}
              </Box>
              <IconButton size="small" onClick={e => { e.stopPropagation(); setJobDialog({ open: true, job }); }}>
                <EditIcon fontSize="inherit" />
              </IconButton>
            </Stack>
            <Stack direction="row" gap={1} mt={0.5} flexWrap="wrap">
              <Chip label={job.status.replace('_', ' ')} size="small" color={STATUS_COLORS[job.status]} />
              <Chip label={`${job.applicantsCount ?? 0} applicants`} size="small" icon={<PersonAddIcon />} />
            </Stack>
          </Paper>
        ))}
        {jobs.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
            <WorkIcon sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="body2">No job postings yet</Typography>
          </Box>
        )}
      </Paper>

      {/* Applicants Panel */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {selectedJob ? (
          <>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Box>
                <Typography variant="h6">{selectedJob.title}</Typography>
                {selectedJob.deadline && (
                  <Typography variant="caption" color="text.secondary">
                    Deadline: {new Date(selectedJob.deadline).toLocaleDateString()}
                  </Typography>
                )}
              </Box>
              <Stack direction="row" gap={1}>
                <Button variant="contained" startIcon={<PersonAddIcon />}
                  onClick={() => setAppDialog({ open: true, applicant: null })}>
                  Add Applicant
                </Button>
              </Stack>
            </Stack>

            {/* Stage filter pills */}
            <Stack direction="row" gap={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
              <Chip label="All" onClick={() => setFilterStage('')}
                variant={filterStage === '' ? 'filled' : 'outlined'} />
              {(Object.keys(STAGE_COLORS) as HrApplicantStage[]).map(s => (
                stageCounts[s] > 0 ? (
                  <Chip key={s} label={`${s.charAt(0).toUpperCase() + s.slice(1)} (${stageCounts[s]})`}
                    color={STAGE_COLORS[s]} onClick={() => setFilterStage(s)}
                    variant={filterStage === s ? 'filled' : 'outlined'} />
                ) : null
              ))}
            </Stack>

            <Box sx={{ overflow: 'auto', flex: 1 }}>
              {filtered.map(ap => (
                <Paper key={ap.id} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
                  <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                    <Box>
                      <Typography variant="body2" fontWeight="bold">{ap.name}</Typography>
                      <Stack direction="row" gap={1.5} mt={0.5}>
                        {ap.email && <Typography variant="caption" color="text.secondary">{ap.email}</Typography>}
                        {ap.phone && <Typography variant="caption" color="text.secondary">{ap.phone}</Typography>}
                        {ap.nationality && <Typography variant="caption" color="text.secondary">{ap.nationality}</Typography>}
                      </Stack>
                      {ap.interviewDate && (
                        <Typography variant="caption" color="text.secondary">
                          Interview: {new Date(ap.interviewDate).toLocaleDateString()}
                        </Typography>
                      )}
                      {ap.offeredSalary && (
                        <Typography variant="caption" color="text.secondary">
                          {' '}· Offered: {ap.offeredSalary}
                        </Typography>
                      )}
                      {ap.notes && <Typography variant="caption" color="text.secondary" display="block">{ap.notes}</Typography>}
                    </Box>
                    <Stack direction="row" gap={0.5} alignItems="center">
                      <Chip label={ap.stage} size="small" color={STAGE_COLORS[ap.stage]} />
                      <Tooltip title="Edit / Move Stage">
                        <IconButton size="small" onClick={() => setAppDialog({ open: true, applicant: ap })}>
                          <EditIcon fontSize="inherit" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
              {filtered.length === 0 && (
                <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                  <Typography variant="body2">No applicants {filterStage ? `in "${filterStage}" stage` : 'yet'}</Typography>
                </Box>
              )}
            </Box>
          </>
        ) : (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
            <Box sx={{ textAlign: 'center' }}>
              <WorkIcon sx={{ fontSize: 60, mb: 2 }} />
              <Typography>Select a job posting to view applicants</Typography>
            </Box>
          </Box>
        )}
      </Box>

      {/* Dialogs */}
      <JobFormDialog
        open={jobDialog.open}
        job={jobDialog.job}
        onClose={() => setJobDialog({ open: false })}
      />
      {selectedJob && (
        <ApplicantFormDialog
          open={appDialog.open}
          jobId={selectedJob.id}
          applicant={appDialog.applicant}
          onClose={() => setAppDialog({ open: false })}
        />
      )}
    </Box>
  );
}
