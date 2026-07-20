<?php

namespace App\Http\Controllers\Hr;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use App\Models\HrJob;
use App\Models\HrApplicant;
use App\Exceptions\NotFoundException;
use App\Exceptions\ConflictException;

class HrRecruitmentController extends Controller
{
    // ── Jobs ──────────────────────────────────────────────────────────────────

    public function listJobs(Request $request)
    {
        return HrJob::where('tenant_id', $request->user()->tenant_id)
            ->when($request->status, fn($q, $s) => $q->where('status', $s))
            ->withCount('applicants')
            ->orderByDesc('created_at')
            ->get();
    }

    public function storeJob(Request $request)
    {
        $request->validate([
            'title'           => 'required|string|max:150',
            'department'      => 'nullable|string|max:100',
            'description'     => 'nullable|string',
            'requirements'    => 'nullable|string',
            'positionsCount'  => 'nullable|integer|min:1',
            'deadline'        => 'nullable|date',
        ]);

        return response()->json(
            HrJob::create([
                'id'              => (string) Str::uuid(),
                'tenant_id'       => $request->user()->tenant_id,
                'title'           => $request->title,
                'department'      => $request->department,
                'description'     => $request->description,
                'requirements'    => $request->requirements,
                'positions_count' => $request->positionsCount ?? 1,
                'deadline'        => $request->deadline,
                'created_by'      => $request->user()->id,
            ]),
            201
        );
    }

    public function updateJob(Request $request, string $id)
    {
        $job = HrJob::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$job) throw new NotFoundException("Job {$id} not found.");

        $request->validate([
            'title'          => 'sometimes|string|max:150',
            'department'     => 'nullable|string|max:100',
            'description'    => 'nullable|string',
            'requirements'   => 'nullable|string',
            'positionsCount' => 'nullable|integer|min:1',
            'status'         => 'sometimes|in:open,on_hold,closed',
            'deadline'       => 'nullable|date',
        ]);

        $job->update(array_filter([
            'title'           => $request->title,
            'department'      => $request->department,
            'description'     => $request->description,
            'requirements'    => $request->requirements,
            'positions_count' => $request->positionsCount,
            'status'          => $request->status,
            'deadline'        => $request->deadline,
        ], fn($v) => $v !== null));

        return $job->loadCount('applicants');
    }

    // ── Applicants ────────────────────────────────────────────────────────────

    public function listApplicants(Request $request, string $jobId)
    {
        $job = HrJob::where('tenant_id', $request->user()->tenant_id)->find($jobId);
        if (!$job) throw new NotFoundException("Job {$jobId} not found.");

        return HrApplicant::where('job_id', $jobId)
            ->when($request->stage, fn($q, $s) => $q->where('stage', $s))
            ->orderByDesc('created_at')
            ->get();
    }

    public function storeApplicant(Request $request, string $jobId)
    {
        $job = HrJob::where('tenant_id', $request->user()->tenant_id)->find($jobId);
        if (!$job) throw new NotFoundException("Job {$jobId} not found.");

        $request->validate([
            'name'        => 'required|string|max:100',
            'email'       => 'nullable|email|max:150',
            'phone'       => 'nullable|string|max:30',
            'nationality' => 'nullable|string|max:60',
            'cvNotes'     => 'nullable|string',
            'notes'       => 'nullable|string',
        ]);

        return response()->json(
            HrApplicant::create([
                'id'          => (string) Str::uuid(),
                'tenant_id'   => $request->user()->tenant_id,
                'job_id'      => $jobId,
                'name'        => $request->name,
                'email'       => $request->email,
                'phone'       => $request->phone,
                'nationality' => $request->nationality,
                'cv_notes'    => $request->cvNotes,
                'notes'       => $request->notes,
            ]),
            201
        );
    }

    public function updateApplicant(Request $request, string $id)
    {
        $applicant = HrApplicant::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$applicant) throw new NotFoundException("Applicant {$id} not found.");

        $request->validate([
            'stage'            => 'sometimes|in:applied,screening,interview,offer,hired,rejected',
            'interviewDate'    => 'nullable|date',
            'offeredSalary'    => 'nullable|numeric|min:0',
            'rejectionReason'  => 'nullable|string',
            'cvNotes'          => 'nullable|string',
            'notes'            => 'nullable|string',
        ]);

        $updates = [];
        if ($request->has('stage'))           $updates['stage']             = $request->stage;
        if ($request->has('interviewDate'))   $updates['interview_date']    = $request->interviewDate;
        if ($request->has('offeredSalary'))   $updates['offered_salary']    = $request->offeredSalary;
        if ($request->has('rejectionReason')) $updates['rejection_reason']  = $request->rejectionReason;
        if ($request->has('cvNotes'))         $updates['cv_notes']          = $request->cvNotes;
        if ($request->has('notes'))           $updates['notes']             = $request->notes;

        if ($request->stage === 'hired' && $request->hiredEmployeeId) {
            $updates['hired_employee_id'] = $request->hiredEmployeeId;
        }

        $applicant->update($updates);
        return $applicant;
    }

    public function destroyApplicant(Request $request, string $id)
    {
        $applicant = HrApplicant::where('tenant_id', $request->user()->tenant_id)->find($id);
        if (!$applicant) throw new NotFoundException("Applicant {$id} not found.");
        $applicant->delete();
        return response()->json(null, 204);
    }
}
