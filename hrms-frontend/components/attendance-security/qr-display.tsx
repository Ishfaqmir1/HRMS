'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { RefreshCw, Clock, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import QRCode from 'qrcode';

interface QrCodeData {
  qrCode: string;
  expiresAt: string;
  expiresInSeconds: number;
}

export default function QRDisplay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrData, setQrData] = useState<QrCodeData | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const generateQr = useMutation({
    mutationFn: (expiresIn?: number) =>
      api.post('/attendance-security/qr/generate', undefined, {
        params: expiresIn ? { expiresIn } : undefined,
      }),
    onSuccess: (res) => {
      const data = res.data?.data || res.data;
      setQrData(data);
      if (data.expiresInSeconds) {
        setTimeLeft(data.expiresInSeconds);
      }
    },
  });

  // Generate QR on mount
  useEffect(() => {
    generateQr.mutate(undefined);
  }, []);

  // Auto-refresh timer
  useEffect(() => {
    if (!qrData || !autoRefresh) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          generateQr.mutate(undefined);
          return qrData.expiresInSeconds;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [qrData, autoRefresh]);

  // Draw QR code on canvas whenever qrData changes
  useEffect(() => {
    if (!canvasRef.current || !qrData?.qrCode) return;
    QRCode.toCanvas(canvasRef.current, qrData.qrCode, {
      width: 200,
      margin: 2,
      color: { dark: '#0B1628', light: '#FFFFFF' },
    });
  }, [qrData]);

  const progress = qrData ? (timeLeft / qrData.expiresInSeconds) * 100 : 0;
  const isExpired = timeLeft <= 0;

  return (
    <div>
      <div className="flex flex-col items-center gap-3">
        <div className="relative rounded-xl bg-white p-4 shadow-sm">
          {isExpired && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/80 backdrop-blur-sm z-10">
              <p className="text-sm font-medium text-ink-faint">Expired — tap refresh</p>
            </div>
          )}
          <canvas ref={canvasRef} width={200} height={200} className="block" />
        </div>

        {/* Timer bar */}
        <div className="w-full max-w-[200px]">
          <div className="flex items-center justify-between text-xs text-ink-faint mb-1">
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {timeLeft}s
            </span>
            <span className="flex items-center gap-1">
              {autoRefresh ? 'Auto-refresh on' : 'Manual'}
            </span>
          </div>
          <div className="h-1 w-full rounded-full bg-ink-faint/20">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                progress > 50 ? 'bg-emerald-500' : progress > 25 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              generateQr.mutate(undefined);
              setAutoRefresh(true);
            }}
            isLoading={generateQr.isPending}
          >
            <RefreshCw size={12} className="mr-1" />
            Refresh
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? 'Pause' : 'Resume'} Auto
          </Button>
        </div>

        {qrData && (
          <div className="flex items-center gap-1 text-xs text-ink-faint">
            <CheckCircle size={10} className="text-emerald-500" />
            QR expires at {new Date(qrData.expiresAt).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}
