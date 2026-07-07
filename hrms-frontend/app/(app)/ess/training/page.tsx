'use client';

import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Calendar, Clock, MapPin } from 'lucide-react';

interface TrainingEnrollment {
  id: string;
  enrolledAt: string;
  status: 'ENROLLED' | 'IN_PROGRESS' | 'COMPLETED' | 'DROPPED';
  completedAt: string | null;
  score: number | null;
  feedback: string | null;
  training: {
    id: string;
    title: string;
    description: string | null;
    provider: string | null;
    duration: string | null;
    mode: string | null;
    startDate: string | null;
    endDate: string | null;
    status: 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  };
}

const STATUS_TONES: Record<string, 'success' | 'warning' | 'default' | 'danger'> = {
  ENROLLED: 'default', IN_PROGRESS: 'warning', COMPLETED: 'success', DROPPED: 'danger',
};

export default function TrainingPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['me', 'training'],
    queryFn: () => unwrap<TrainingEnrollment[]>(api.get('/me/training')),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">My Training</h1>

      <Card>
        <CardHeader><CardTitle>Enrolled Courses</CardTitle></CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-ink-faint">Loading training…</p>}
          {data && data.length === 0 && (
            <p className="text-sm text-ink-faint">You are not enrolled in any training programs.</p>
          )}
          {data && data.length > 0 && (
            <div className="grid grid-cols-1 gap-4">
              {data.map((enrollment) => (
                <div key={enrollment.id} className="rounded-md border border-border p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent-soft text-accent">
                        <BookOpen size={20} />
                      </div>
                      <div>
                        <p className="font-medium text-ink">{enrollment.training.title}</p>
                        <p className="text-sm text-ink-soft">{enrollment.training.description || ''}</p>
                      </div>
                    </div>
                    <Badge tone={STATUS_TONES[enrollment.status]}>{enrollment.status}</Badge>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-ink-faint">
                    {enrollment.training.provider && (
                      <span className="flex items-center gap-1">
                        <Calendar size={12} /> {enrollment.training.provider}
                      </span>
                    )}
                    {enrollment.training.duration && (
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> {enrollment.training.duration}
                      </span>
                    )}
                    {enrollment.training.mode && (
                      <span className="flex items-center gap-1">
                        <MapPin size={12} /> {enrollment.training.mode}
                      </span>
                    )}
                    {enrollment.training.startDate && (
                      <span>
                        {new Date(enrollment.training.startDate).toLocaleDateString()}
                        {enrollment.training.endDate ? ` — ${new Date(enrollment.training.endDate).toLocaleDateString()}` : ''}
                      </span>
                    )}
                  </div>

                  {enrollment.score != null && (
                    <div className="mt-2">
                      <span className="text-sm text-ink-soft">Score: </span>
                      <span className="font-medium text-ink">{enrollment.score}%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
