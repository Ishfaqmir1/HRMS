'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, Smartphone, Wifi, QrCode, Camera, Fingerprint, MapPin, Globe, Network, Clock, Lock } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface SecurityConfig {
  id: string;
  requireTrustedDevice: boolean;
  maxTrustedDevices: number;
  requireWifiVerification: boolean;
  requireIpValidation: boolean;
  requireQrScan: boolean;
  qrCodeRefreshSeconds: number;
  requireFaceVerification: boolean;
  faceMatchThreshold: number;
  requireLivenessCheck: boolean;
  enforceDeviceBinding: boolean;
  allowedDevicesPerEmployee: number;
  checkLocationIntegrity: boolean;
  detectVpn: boolean;
  detectNetworkChange: boolean;
  captureAttendancePhoto: boolean;
  strictMode: boolean;
}

interface ConfigSummary {
  config: SecurityConfig;
  enabledLayers: { layer: number; name: string }[];
  activeLayerCount: number;
  totalLayerCount: number;
  securityScore: number;
}

const LAYER_INFO: Record<number, { name: string; icon: any; description: string }> = {
  1: { name: 'JWT Authentication', icon: Lock, description: 'Token-based authentication via JWT + refresh tokens' },
  2: { name: 'Trusted Devices', icon: Smartphone, description: 'Register and verify devices for attendance' },
  3: { name: 'GPS Location', icon: MapPin, description: 'Capture GPS coordinates at each attendance event' },
  4: { name: 'Geo-Fence', icon: MapPin, description: 'Validate location within branch radius' },
  5: { name: 'Wi-Fi Verification', icon: Wifi, description: 'Verify connection to authorized office Wi-Fi' },
  6: { name: 'IP Validation', icon: Globe, description: 'Validate IP against authorized branch allowlist' },
  7: { name: 'QR Code Scan', icon: QrCode, description: 'Dynamic QR codes that refresh every 30-60 seconds' },
  8: { name: 'Face Verification', icon: Camera, description: 'Face recognition matching enrolled templates' },
  9: { name: 'Liveness Detection', icon: Fingerprint, description: 'Blink/head movement checks against spoofing' },
  10: { name: 'Device Binding', icon: Smartphone, description: 'Limit employees to registered devices only' },
  11: { name: 'Location Integrity', icon: MapPin, description: 'Detect simulated/spoofed GPS locations' },
  12: { name: 'VPN Detection', icon: Globe, description: 'Flag attendance events originating from VPNs' },
  13: { name: 'Network Change', icon: Network, description: 'Detect network changes during attendance flow' },
  14: { name: 'Time Validation', icon: Clock, description: 'Server-side time enforcement (never trust device clock)' },
  15: { name: 'Attendance Photo', icon: Camera, description: 'Capture selfie at check-in/check-out' },
  16: { name: 'Audit Log', icon: Shield, description: 'Comprehensive audit trail for all attendance events' },
};

function LayerIcon({ layer, active }: { layer: number; active: boolean }) {
  const info = LAYER_INFO[layer];
  if (!info) return <Shield size={16} />;
  const Icon = info.icon;
  return <Icon size={16} className={active ? 'text-emerald-400' : 'text-white/30'} />;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div className="relative">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
        <div className="w-10 h-5 bg-white/10 rounded-full peer-checked:bg-emerald-500 transition-colors" />
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </div>
      <span className="text-sm text-white/80">{label}</span>
    </label>
  );
}

export default function AttendanceSecurityConfigPage() {
  const queryClient = useQueryClient();

  const { data: summary, isLoading } = useQuery<ConfigSummary>({
    queryKey: ['attendance-security', 'config-summary'],
    queryFn: async () => {
      const res = await api.get('/attendance-security/config/summary');
      return res.data;
    },
  });

  const { data: rawConfig } = useQuery<SecurityConfig>({
    queryKey: ['attendance-security', 'config'],
    queryFn: async () => {
      const res = await api.get('/attendance-security/config');
      return res.data;
    },
  });

  const updateConfig = useMutation({
    mutationFn: (data: Partial<SecurityConfig>) => api.patch('/attendance-security/config', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-security'] });
    },
  });

  const [form, setForm] = useState<Partial<SecurityConfig>>({});

  const config = rawConfig || summary?.config;
  const activeConfig = { ...config, ...form };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <h1 className="font-serif text-2xl font-semibold text-ink">Attendance Security</h1>
        <p className="text-sm text-ink-faint">Loading security configuration...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Attendance Security</h1>
          <p className="text-sm text-ink-soft mt-1">Configure all 16 security layers for attendance verification</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-ink-faint">Security Score</p>
            <p className={`text-2xl font-bold ${(summary?.securityScore ?? 0) >= 70 ? 'text-emerald-500' : (summary?.securityScore ?? 0) >= 40 ? 'text-amber-500' : 'text-red-500'}`}>
              {summary?.securityScore ?? 0}%
            </p>
          </div>
          <div className="h-16 w-16 rounded-full border-4 border-ink-faint/20 flex items-center justify-center">
            <span className="text-xs text-ink-faint">{summary?.activeLayerCount ?? 3}/{summary?.totalLayerCount ?? 16}</span>
          </div>
        </div>
      </div>

      {/* Layer Progress */}
      <Card className="bg-ink text-white">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-white/80">16 Security Layers</p>
            <p className="text-xs text-white/50">{summary?.activeLayerCount ?? 3} active / {summary?.totalLayerCount ?? 16} total</p>
          </div>
          <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(16, 1fr)' }}>
            {Array.from({ length: 16 }, (_, i) => {
              const layer = i + 1;
              const isActive = summary?.enabledLayers?.some((l) => l.layer === layer) ||
                [1, 3, 4, 14, 16].includes(layer); // Always active layers
              return (
                <div key={layer} className="flex flex-col items-center gap-1" title={LAYER_INFO[layer]?.name}>
                  <div className={`w-full h-2 rounded ${isActive ? 'bg-emerald-500' : 'bg-white/10'}`} />
                  <span className="text-[10px] text-white/40">{layer}</span>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {summary?.enabledLayers?.concat(
              [{ layer: 1, name: 'JWT Auth' }, { layer: 3, name: 'GPS' }, { layer: 4, name: 'Geo-Fence' }, { layer: 14, name: 'Server Time' }, { layer: 16, name: 'Audit Log' }]
            ).sort((a, b) => a.layer - b.layer).map((l) => (
              <Badge key={l.layer} tone="success" className="text-[11px]">
                <LayerIcon layer={l.layer} active={true} />
                <span className="ml-1">L{l.layer} {l.name}</span>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Layer Cards - Togglable */}
      <Card className="bg-ink text-white">
        <CardHeader>
          <CardTitle className="text-white">Security Layer Configuration</CardTitle>
          <CardDescription className="text-white/50">Toggle each layer on/off and configure thresholds</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Layer 2: Trusted Devices */}
          <div className="rounded-lg bg-white/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-emerald-500/20 p-2"><Smartphone size={18} className="text-emerald-400" /></div>
                <div>
                  <p className="text-sm font-medium text-white">Layer 2: Trusted Devices</p>
                  <p className="text-xs text-white/50">Register and verify devices before attendance</p>
                </div>
              </div>
              <Toggle checked={activeConfig.requireTrustedDevice ?? false} onChange={(v) => setForm((f) => ({ ...f, requireTrustedDevice: v }))} label="" />
            </div>
            {activeConfig.requireTrustedDevice && (
              <div className="flex items-center gap-4 pl-12">
                <label className="text-xs text-white/60">Max devices:</label>
                <Input type="number" min={1} max={10} value={activeConfig.maxTrustedDevices ?? 3}
                  onChange={(e) => setForm((f) => ({ ...f, maxTrustedDevices: parseInt(e.target.value) || 3 }))}
                  className="w-20 text-xs" />
                <label className="text-xs text-white/60">Device binding:</label>
                <Toggle checked={activeConfig.enforceDeviceBinding ?? false} onChange={(v) => setForm((f) => ({ ...f, enforceDeviceBinding: v }))} label="" />
              </div>
            )}
          </div>

          {/* Layer 5: Wi-Fi */}
          <div className="rounded-lg bg-white/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-emerald-500/20 p-2"><Wifi size={18} className="text-emerald-400" /></div>
                <div>
                  <p className="text-sm font-medium text-white">Layer 5: Wi-Fi Verification</p>
                  <p className="text-xs text-white/50">Verify employee is connected to authorized office Wi-Fi</p>
                </div>
              </div>
              <Toggle checked={activeConfig.requireWifiVerification ?? false} onChange={(v) => setForm((f) => ({ ...f, requireWifiVerification: v }))} label="" />
            </div>
          </div>

          {/* Layer 6: IP */}
          <div className="rounded-lg bg-white/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-emerald-500/20 p-2"><Globe size={18} className="text-emerald-400" /></div>
                <div>
                  <p className="text-sm font-medium text-white">Layer 6: IP Validation</p>
                  <p className="text-xs text-white/50">Allow attendance only from authorized IP addresses</p>
                </div>
              </div>
              <Toggle checked={activeConfig.requireIpValidation ?? false} onChange={(v) => setForm((f) => ({ ...f, requireIpValidation: v }))} label="" />
            </div>
          </div>

          {/* Layer 7: QR */}
          <div className="rounded-lg bg-white/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-emerald-500/20 p-2"><QrCode size={18} className="text-emerald-400" /></div>
                <div>
                  <p className="text-sm font-medium text-white">Layer 7: QR Code Scan</p>
                  <p className="text-xs text-white/50">Dynamic QR codes that refresh periodically</p>
                </div>
              </div>
              <Toggle checked={activeConfig.requireQrScan ?? false} onChange={(v) => setForm((f) => ({ ...f, requireQrScan: v }))} label="" />
            </div>
            {activeConfig.requireQrScan && (
              <div className="flex items-center gap-4 pl-12">
                <label className="text-xs text-white/60">Refresh (seconds):</label>
                <Input type="number" min={15} max={300} value={activeConfig.qrCodeRefreshSeconds ?? 45}
                  onChange={(e) => setForm((f) => ({ ...f, qrCodeRefreshSeconds: parseInt(e.target.value) || 45 }))}
                  className="w-20 text-xs" />
              </div>
            )}
          </div>

          {/* Layer 8 & 9: Face + Liveness */}
          <div className="rounded-lg bg-white/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-emerald-500/20 p-2"><Camera size={18} className="text-emerald-400" /></div>
                <div>
                  <p className="text-sm font-medium text-white">Layer 8: Face Verification</p>
                  <p className="text-xs text-white/50">Face recognition matching against enrolled templates</p>
                </div>
              </div>
              <Toggle checked={activeConfig.requireFaceVerification ?? false} onChange={(v) => setForm((f) => ({ ...f, requireFaceVerification: v }))} label="" />
            </div>
            {activeConfig.requireFaceVerification && (
              <div className="flex items-center gap-6 pl-12">
                <div className="space-y-2">
                  <label className="text-xs text-white/60">Match threshold:</label>
                  <div className="flex items-center gap-2">
                    <input type="range" min={0.5} max={0.95} step={0.05} value={activeConfig.faceMatchThreshold ?? 0.75}
                      onChange={(e) => setForm((f) => ({ ...f, faceMatchThreshold: parseFloat(e.target.value) }))}
                      className="w-24" />
                    <span className="text-xs text-white/80">{((activeConfig.faceMatchThreshold ?? 0.75) * 100).toFixed(0)}%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-white/60">Liveness detection:</label>
                  <Toggle checked={activeConfig.requireLivenessCheck ?? false} onChange={(v) => setForm((f) => ({ ...f, requireLivenessCheck: v }))} label="" />
                </div>
              </div>
            )}
          </div>

          {/* Layer 11-15 */}
          <div className="rounded-lg bg-white/5 p-4 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-white/40">Additional Checks</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-amber-400" />
                  <span className="text-sm text-white/80">Location Integrity</span>
                </div>
                <Toggle checked={activeConfig.checkLocationIntegrity ?? false} onChange={(v) => setForm((f) => ({ ...f, checkLocationIntegrity: v }))} label="" />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe size={14} className="text-amber-400" />
                  <span className="text-sm text-white/80">VPN Detection</span>
                </div>
                <Toggle checked={activeConfig.detectVpn ?? false} onChange={(v) => setForm((f) => ({ ...f, detectVpn: v }))} label="" />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Network size={14} className="text-amber-400" />
                  <span className="text-sm text-white/80">Network Change Detection</span>
                </div>
                <Toggle checked={activeConfig.detectNetworkChange ?? false} onChange={(v) => setForm((f) => ({ ...f, detectNetworkChange: v }))} label="" />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera size={14} className="text-amber-400" />
                  <span className="text-sm text-white/80">Attendance Selfie</span>
                </div>
                <Toggle checked={activeConfig.captureAttendancePhoto ?? false} onChange={(v) => setForm((f) => ({ ...f, captureAttendancePhoto: v }))} label="" />
              </div>
            </div>
          </div>

          {/* Strict Mode */}
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-red-500/20 p-2"><Shield size={18} className="text-red-400" /></div>
                <div>
                  <p className="text-sm font-medium text-white">Strict Mode</p>
                  <p className="text-xs text-white/50">Block attendance entirely if ANY required check fails. Otherwise, flagged entries are recorded for review.</p>
                </div>
              </div>
              <Toggle checked={activeConfig.strictMode ?? false} onChange={(v) => setForm((f) => ({ ...f, strictMode: v }))} label="" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      {Object.keys(form).length > 0 && (
        <div className="flex justify-end">
          <Button
            onClick={() => {
              updateConfig.mutate(form);
              setForm({});
            }}
            isLoading={updateConfig.isPending}
          >
            Save Security Configuration
          </Button>
        </div>
      )}

      {/* Branch Network Config Links */}
      <Card>
        <CardHeader>
          <CardTitle>Branch Network Configuration</CardTitle>
          <CardDescription>Manage Wi-Fi networks and IP allowlists per branch</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <a href="/branches" className="rounded-lg border border-border hover:bg-ink-soft/5 p-4 transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <Wifi size={18} className="text-ink-soft" />
                <p className="font-medium text-ink">Wi-Fi Networks</p>
              </div>
              <p className="text-xs text-ink-faint">Configure authorized Wi-Fi SSIDs and BSSIDs per branch</p>
            </a>
            <a href="/branches" className="rounded-lg border border-border hover:bg-ink-soft/5 p-4 transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <Globe size={18} className="text-ink-soft" />
                <p className="font-medium text-ink">IP Allowlists</p>
              </div>
              <p className="text-xs text-ink-faint">Configure authorized IP addresses per branch</p>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
