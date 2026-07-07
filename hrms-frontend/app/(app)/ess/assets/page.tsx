'use client';

import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Laptop, Smartphone, Tablet, Car, Sofa, CreditCard, Package } from 'lucide-react';

interface AssetAssignment {
  id: string;
  assignedAt: string;
  returnedAt: string | null;
  status: 'ASSIGNED' | 'RETURNED' | 'LOST' | 'DAMAGED';
  notes: string | null;
  asset: {
    id: string;
    name: string;
    type: string;
    serialNumber: string | null;
    model: string | null;
    brand: string | null;
  };
}

const STATUS_TONES: Record<string, 'success' | 'default' | 'danger' | 'warning'> = {
  ASSIGNED: 'success', RETURNED: 'default', LOST: 'danger', DAMAGED: 'warning',
};

const TYPE_ICONS: Record<string, any> = {
  LAPTOP: Laptop, MOBILE: Smartphone, TABLET: Tablet,
  VEHICLE: Car, FURNITURE: Sofa, ACCESS_CARD: CreditCard,
};

export default function AssetsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['me', 'assets'],
    queryFn: () => unwrap<AssetAssignment[]>(api.get('/me/assets')),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">My Assets</h1>

      <Card>
        <CardHeader><CardTitle>Assigned Assets</CardTitle></CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-ink-faint">Loading assets…</p>}
          {data && data.length === 0 && (
            <p className="text-sm text-ink-faint">No assets assigned to you.</p>
          )}
          {data && data.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {data.map((a) => {
                const Icon = TYPE_ICONS[a.asset.type] || Package;
                return (
                  <div key={a.id} className="flex gap-4 rounded-md border border-border p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-paper text-ink-faint">
                      <Icon size={24} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-ink">{a.asset.name}</p>
                          <p className="text-xs text-ink-faint">
                            {a.asset.type} {a.asset.brand ? `· ${a.asset.brand}` : ''} {a.asset.model ? `· ${a.asset.model}` : ''}
                          </p>
                        </div>
                        <Badge tone={STATUS_TONES[a.status]}>{a.status}</Badge>
                      </div>
                      <div className="mt-2 text-xs text-ink-faint">
                        {a.asset.serialNumber && <span>SN: {a.asset.serialNumber} · </span>}
                        Assigned: {new Date(a.assignedAt).toLocaleDateString()}
                        {a.returnedAt && ` · Returned: ${new Date(a.returnedAt).toLocaleDateString()}`}
                      </div>
                      {a.notes && <p className="mt-1 text-xs text-ink-soft">{a.notes}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
