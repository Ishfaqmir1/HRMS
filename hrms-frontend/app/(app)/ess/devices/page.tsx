'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Smartphone, Laptop, Monitor, Tablet, Globe, Trash2, CheckCircle, Shield, Plus } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface TrustedDevice {
  id: string;
  deviceId: string;
  deviceName: string | null;
  platform: string | null;
  osVersion: string | null;
  browserInfo: string | null;
  isTrusted: boolean;
  isActive: boolean;
  lastUsedAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

function DeviceIcon({ platform }: { platform: string | null }) {
  switch (platform) {
    case 'ios':
    case 'android':
      return <Smartphone size={24} className="text-ink-soft" />;
    case 'windows':
      return <Monitor size={24} className="text-ink-soft" />;
    case 'macos':
      return <Laptop size={24} className="text-ink-soft" />;
    case 'linux':
      return <Monitor size={24} className="text-ink-soft" />;
    default:
      return <Globe size={24} className="text-ink-soft" />;
  }
}

function formatDate(iso: string | null) {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function MyDevicesPage() {
  const queryClient = useQueryClient();
  const [showRegister, setShowRegister] = useState(false);
  const [newDevice, setNewDevice] = useState({ deviceId: '', deviceName: '', platform: 'web' });

  const { data: devices, isLoading } = useQuery<TrustedDevice[]>({
    queryKey: ['attendance-security', 'devices'],
    queryFn: async () => {
      const res = await api.get('/attendance-security/devices');
      return res.data;
    },
  });

  const registerDevice = useMutation({
    mutationFn: (data: typeof newDevice) => api.post('/attendance-security/devices/register', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-security', 'devices'] });
      setShowRegister(false);
      setNewDevice({ deviceId: '', deviceName: '', platform: 'web' });
    },
  });

  const trustDevice = useMutation({
    mutationFn: (deviceId: string) => api.post(`/attendance-security/devices/${deviceId}/trust`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attendance-security', 'devices'] }),
  });

  const removeDevice = useMutation({
    mutationFn: (deviceId: string) => api.delete(`/attendance-security/devices/${deviceId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attendance-security', 'devices'] }),
  });

  // Generate a device fingerprint
  function generateDeviceId() {
    const nav = navigator as any;
    const screen = window.screen;
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency,
      nav.deviceMemory || '',
    ];
    const fingerprint = components.join('|||');
    // Simple hash
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return `web-${Math.abs(hash).toString(16)}`;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">My Devices</h1>
          <p className="text-sm text-ink-soft mt-1">Manage trusted devices for attendance verification</p>
        </div>
        <Button onClick={() => {
          setNewDevice((f) => ({ ...f, deviceId: generateDeviceId() }));
          setShowRegister(!showRegister);
        }}>
          <Plus size={14} className="mr-1" />
          Register Device
        </Button>
      </div>

      {showRegister && (
        <Card>
          <CardHeader>
            <CardTitle>Register New Device</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-ink-faint">Device Name</label>
                <Input
                  placeholder="e.g. My Work Laptop"
                  value={newDevice.deviceName}
                  onChange={(e) => setNewDevice((f) => ({ ...f, deviceName: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-ink-faint">Platform</label>
                <select
                  value={newDevice.platform}
                  onChange={(e) => setNewDevice((f) => ({ ...f, platform: e.target.value }))}
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-ink"
                >
                  <option value="web">Web Browser</option>
                  <option value="windows">Windows</option>
                  <option value="macos">macOS</option>
                  <option value="linux">Linux</option>
                  <option value="ios">iOS</option>
                  <option value="android">Android</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-ink-faint">Device ID (fingerprint)</label>
              <Input
                value={newDevice.deviceId}
                onChange={(e) => setNewDevice((f) => ({ ...f, deviceId: e.target.value }))}
                className="font-mono text-xs"
              />
              <p className="text-xs text-ink-faint mt-1">
                This is a unique identifier generated from your browser/device properties
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowRegister(false)}>Cancel</Button>
              <Button
                onClick={() => registerDevice.mutate(newDevice)}
                isLoading={registerDevice.isPending}
                disabled={!newDevice.deviceId}
              >
                Register Device
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && <p className="text-sm text-ink-faint">Loading devices...</p>}

      {devices && devices.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Smartphone size={48} className="mx-auto mb-4 text-ink-faint" />
            <p className="text-ink-faint">No devices registered yet.</p>
            <p className="text-xs text-ink-faint mt-1">Register a device to use for secure attendance tracking.</p>
          </CardContent>
        </Card>
      )}

      {devices && devices.length > 0 && (
        <div className="space-y-3">
          {devices.map((device) => (
            <Card key={device.id} className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <DeviceIcon platform={device.platform} />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-ink">{device.deviceName || 'Unnamed Device'}</p>
                      {device.isTrusted ? (
                        <Badge tone="success"><CheckCircle size={10} className="mr-1" /> Trusted</Badge>
                      ) : (
                        <Badge tone="warning">Pending Verification</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-ink-faint">
                      <span>{device.platform || 'web'}{device.osVersion ? ` ${device.osVersion}` : ''}</span>
                      <span>·</span>
                      <span>Last used: {formatDate(device.lastUsedAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!device.isTrusted && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => trustDevice.mutate(device.deviceId)}
                      isLoading={trustDevice.isPending}
                    >
                      <Shield size={12} className="mr-1" />
                      Verify & Trust
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    className="text-red-500 hover:bg-red-50"
                    onClick={() => removeDevice.mutate(device.deviceId)}
                    isLoading={removeDevice.isPending}
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
