'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import dynamic from 'next/dynamic';
import { MapPin, Navigation } from 'lucide-react';
import { api, unwrap } from '@/lib/api-client';
import { Branch, PaginatedResult } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

// Dynamically import the map (Leaflet requires browser globals)
const MapPreview = dynamic(() => import('@/components/map-preview'), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 w-full items-center justify-center rounded-lg border border-border/50 bg-muted/30">
      <div className="flex flex-col items-center gap-2 text-sm text-ink-faint">
        <MapPin size={20} />
        <span>Loading map…</span>
      </div>
    </div>
  ),
});

const geoFormSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  geoFenceRadiusMeters: z.coerce.number().min(50).max(5000).default(500),
});
type GeoForm = z.infer<typeof geoFormSchema>;

export default function BranchesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [geoDialog, setGeoDialog] = useState<Branch | null>(null);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'locating' | 'located' | 'error'>('idle');

  const { data, isLoading } = useQuery({
    queryKey: ['branches', page, search],
    queryFn: () =>
      unwrap<PaginatedResult<Branch>>(
        api.get('/branches', { params: { page, limit: 20, search: search || undefined } }),
      ),
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<GeoForm>({
    resolver: zodResolver(geoFormSchema),
    defaultValues: { latitude: 0, longitude: 0, geoFenceRadiusMeters: 500 },
  });

  // Watch lat/lng/radius so the map preview stays in sync
  const watchedLat = useWatch({ control, name: 'latitude' });
  const watchedLng = useWatch({ control, name: 'longitude' });
  const watchedRadius = useWatch({ control, name: 'geoFenceRadiusMeters' });

  const mapCoords = useMemo(
    () => ({ latitude: watchedLat ?? 0, longitude: watchedLng ?? 0, radiusMeters: watchedRadius ?? 500 }),
    [watchedLat, watchedLng, watchedRadius],
  );

  function openGeoDialog(branch: Branch) {
    setGeoDialog(branch);
    setGeoStatus('idle');
    const lat = branch.latitude ?? 0;
    const lng = branch.longitude ?? 0;
    setValue('latitude', lat);
    setValue('longitude', lng);
    setValue('geoFenceRadiusMeters', branch.geoFenceRadiusMeters ?? 500);
  }

  function detectCurrentLocation() {
    if (!navigator.geolocation) {
      setGeoStatus('error');
      return;
    }
    setGeoStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setValue('latitude', position.coords.latitude);
        setValue('longitude', position.coords.longitude);
        setGeoStatus('located');
      },
      () => {
        setGeoStatus('error');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const saveGeoMutation = useMutation({
    mutationFn: (values: GeoForm) =>
      api.patch(`/branches/${geoDialog!.id}/geo`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      setGeoDialog(null);
    },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="ledger-tab font-serif text-2xl font-semibold text-ink">Branches</h1>
      </div>

      <Card>
        <CardContent className="pt-5">
          <Input
            placeholder="Search branches…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="mb-4 max-w-sm"
          />

          {isLoading && <p className="text-sm text-ink-faint">Loading branches…</p>}

          {data && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Geo-Fence</TableHead>
                    <TableHead>Head Office</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((branch) => (
                    <TableRow key={branch.id}>
                      <TableCell className="font-medium text-ink">{branch.name}</TableCell>
                      <TableCell><span className="record-code">{branch.code || '—'}</span></TableCell>
                      <TableCell className="text-ink-soft">
                        {branch.city ? `${branch.city}${branch.country ? `, ${branch.country}` : ''}` : '—'}
                      </TableCell>
                      <TableCell>
                        {branch.latitude != null && branch.longitude != null ? (
                          <Badge variant="success">
                            <MapPin size={10} className="mr-1" />
                            {branch.geoFenceRadiusMeters ?? 500}m
                          </Badge>
                        ) : (
                          <Badge variant="warning">Not set</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {branch.isHeadOffice ? <Badge variant="success">Yes</Badge> : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openGeoDialog(branch)}>
                          <MapPin size={14} /> Set geo-fence
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-ink-faint">
                        No branches found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <div className="mt-4 flex items-center justify-between text-sm text-ink-faint">
                <span>Page {data.meta.page} of {Math.max(data.meta.totalPages, 1)} · {data.meta.total} total</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Geo-Fence Dialog */}
      <Dialog open={!!geoDialog} onOpenChange={(o) => !o && setGeoDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Geo-Fence: {geoDialog?.name}</DialogTitle>
            <DialogDescription>
              Set the branch location and check-in radius. Employees must be within this radius to clock in.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit((values) => saveGeoMutation.mutate(values))} className="space-y-4">
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={detectCurrentLocation} className="flex-1">
                <Navigation size={14} />
                {geoStatus === 'locating' ? 'Detecting…' : 'Use my location'}
              </Button>
              {geoStatus === 'located' && <span className="text-xs text-accent self-center">✅ Location captured</span>}
              {geoStatus === 'error' && <span className="text-xs text-danger self-center">❌ Location unavailable</span>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="latitude">Latitude</Label>
                <Input id="latitude" type="number" step="any" placeholder="40.7128" {...register('latitude')} />
                <FieldError message={errors.latitude?.message} />
              </div>
              <div>
                <Label htmlFor="longitude">Longitude</Label>
                <Input id="longitude" type="number" step="any" placeholder="-74.0060" {...register('longitude')} />
                <FieldError message={errors.longitude?.message} />
              </div>
            </div>
            <div>
              <Label htmlFor="geoFenceRadiusMeters">Fence radius (meters)</Label>
              <Input id="geoFenceRadiusMeters" type="number" placeholder="500" {...register('geoFenceRadiusMeters')} />
              <p className="mt-1 text-xs text-ink-faint">Min: 50m · Max: 5000m · Default: 500m</p>
              <FieldError message={errors.geoFenceRadiusMeters?.message} />
            </div>

            {/* Animated map preview — updates live as lat/lng/radius change */}
            {(watchedLat !== undefined && watchedLng !== undefined) && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-500">
                <MapPreview
                  latitude={mapCoords.latitude}
                  longitude={mapCoords.longitude}
                  radiusMeters={mapCoords.radiusMeters}
                  branchName={geoDialog?.name ?? ''}
                />
              </div>
            )}

            {saveGeoMutation.isError && (
              <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
                {(saveGeoMutation.error as any)?.response?.data?.message || 'Could not save geo-fence.'}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setGeoDialog(null)}>Cancel</Button>
              <Button type="submit" isLoading={saveGeoMutation.isPending}>Save geo-fence</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
