'use client';

import { useQuery } from '@tanstack/react-query';
import { Briefcase, Users, CalendarCheck, FileText } from 'lucide-react';
import { api, unwrap } from '@/lib/api-client';
import { RecruitmentDashboard, JobPosting } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const STAGE_LABELS: Record<string, string> = {
  NEW: 'New', SCREENING: 'Screening', SHORTLISTED: 'Shortlisted',
  INTERVIEW: 'Interview', OFFERED: 'Offered', HIRED: 'Hired',
  REJECTED: 'Rejected', WITHDRAWN: 'Withdrawn',
};

export default function RecruitmentPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['recruitment', 'dashboard'],
    queryFn: () => unwrap<RecruitmentDashboard>(api.get('/recruitment/dashboard')),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">Recruitment</h1>
        <div className="flex gap-2">
          <Link href="/recruitment/jobs"><Button variant="outline" size="sm">Job Postings</Button></Link>
          <Link href="/recruitment/applicants"><Button variant="outline" size="sm">Applicants</Button></Link>
        </div>
      </div>

      {isLoading && <p className="text-sm text-ink-faint">Loading recruitment dashboard…</p>}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-ink-soft">Active Jobs</CardTitle>
                <Briefcase size={16} className="text-ink-faint" />
              </CardHeader>
              <CardContent>
                <p className="font-serif text-2xl font-semibold text-ink">{data.activeJobs}</p>
                <p className="text-xs text-ink-faint">Published positions</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-ink-soft">Total Applicants</CardTitle>
                <Users size={16} className="text-ink-faint" />
              </CardHeader>
              <CardContent>
                <p className="font-serif text-2xl font-semibold text-ink">{data.totalApplications}</p>
                <p className="text-xs text-ink-faint">All time</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-ink-soft">Upcoming Interviews</CardTitle>
                <CalendarCheck size={16} className="text-ink-faint" />
              </CardHeader>
              <CardContent>
                <p className="font-serif text-2xl font-semibold text-ink">{data.pendingInterviews}</p>
                <p className="text-xs text-ink-faint">Scheduled</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Pipeline stages */}
            <Card>
              <CardHeader>
                <CardTitle>Pipeline</CardTitle>
              </CardHeader>
              <CardContent>
                {data.stageCounts.length > 0 ? (
                  <div className="space-y-3">
                    {data.stageCounts.map((s) => (
                      <div key={s.status} className="flex items-center justify-between">
                        <span className="text-sm text-ink-soft">{STAGE_LABELS[s.status] || s.status}</span>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${Math.min((s._count / Math.max(...data.stageCounts.map(x => x._count))) * 100, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-ink">{s._count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-ink-faint">No applicants yet.</p>
                )}
              </CardContent>
            </Card>

            {/* Recent applications */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Applications</CardTitle>
              </CardHeader>
              <CardContent>
                {data.recentApplications.length > 0 ? (
                  <div className="space-y-3">
                    {data.recentApplications.map((a) => (
                      <div key={a.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-ink">{a.candidateName}</p>
                          <p className="text-xs text-ink-faint">{a.jobPosting?.title}</p>
                        </div>
                        <Badge variant={a.status === 'NEW' ? 'default' : a.status === 'REJECTED' ? 'destructive' : 'success'}>
                          {a.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-ink-faint">No recent applications.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Link href="/recruitment/jobs">
              <Card className="cursor-pointer transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-3 py-4">
                  <Briefcase size={20} className="text-primary" />
                  <div>
                    <p className="font-medium text-ink">Job Postings</p>
                    <p className="text-xs text-ink-faint">Create and manage job listings</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/recruitment/applicants">
              <Card className="cursor-pointer transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-3 py-4">
                  <Users size={20} className="text-primary" />
                  <div>
                    <p className="font-medium text-ink">Applicants</p>
                    <p className="text-xs text-ink-faint">Track and manage applicants</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href="/recruitment/interviews">
              <Card className="cursor-pointer transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-3 py-4">
                  <CalendarCheck size={20} className="text-primary" />
                  <div>
                    <p className="font-medium text-ink">Interviews</p>
                    <p className="text-xs text-ink-faint">Schedule and manage interviews</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
