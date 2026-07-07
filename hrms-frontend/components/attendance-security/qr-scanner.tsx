'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Camera, CameraOff, Scan, CheckCircle, XCircle } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import jsQR from 'jsqr';

interface QRScannerProps {
  onScan: (qrCode: string) => void;
  disabled?: boolean;
}

export default function QRScanner({ onScan, disabled }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanningRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastCodeRef = useRef<string>('');
  const [showCamera, setShowCamera] = useState(false);
  const [scanResult, setScanResult] = useState<'success' | 'error' | null>(null);

  const verifyQr = useMutation({
    mutationFn: (code: string) => {
      lastCodeRef.current = code;
      return api.post('/attendance-security/qr/verify', { code });
    },
    onSuccess: (res) => {
      const data = res.data?.data || res.data;
      if (data.valid) {
        setScanResult('success');
        onScan(lastCodeRef.current);
        stopCamera();
      } else {
        setScanResult('error');
        setTimeout(() => setScanResult(null), 2000);
      }
    },
    onError: () => {
      setScanResult('error');
      setTimeout(() => setScanResult(null), 2000);
    },
  });

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
  }, []);

  const scanLoop = useCallback(() => {
    if (!scanningRef.current || !videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (video.readyState >= 2) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      try {
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          setScanResult('success');
          stopCamera();
          onScan(code.data);
          return;
        }
      } catch {
        // Scanning error - continue next frame
      }
    }

    if (scanningRef.current) {
      animFrameRef.current = requestAnimationFrame(scanLoop);
    }
  }, [verifyQr]);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      scanningRef.current = true;
      setShowCamera(true);
      animFrameRef.current = requestAnimationFrame(scanLoop);
    } catch (err) {
      console.warn('Camera access denied:', err);
    }
  }

  // Stop camera if disabled externally
  useEffect(() => {
    if (disabled && showCamera) {
      stopCamera();
    }
  }, [disabled, showCamera, stopCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      scanningRef.current = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [stopCamera]);

  return (
    <div>
      {!showCamera ? (
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-xl border-2 border-dashed border-ink-faint/30 p-8 text-center">
            <Scan size={48} className="mx-auto mb-3 text-ink-faint" />
            <p className="text-sm text-ink-faint mb-4">
              Point your camera at the QR code displayed on the attendance terminal
            </p>
            <Button
              variant="secondary"
              onClick={startCamera}
              disabled={disabled || verifyQr.isPending}
            >
              <Camera size={14} className="mr-1" />
              Open Scanner
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-xl bg-black">
          <video
            ref={videoRef}
            className="w-full h-48 object-cover"
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Scanning overlay */}
          <div className="absolute inset-0 border-2 border-emerald-500/50 rounded-xl pointer-events-none">
            <div className="absolute inset-x-4 top-1/2 h-0.5 -translate-y-1/2 bg-emerald-400/60 shadow-[0_0_8px_rgba(52,211,153,0.6)] animate-pulse" />
          </div>

          {/* Result badge */}
          {scanResult === 'success' && (
            <div className="absolute top-2 right-2">
              <Badge tone="success"><CheckCircle size={10} className="mr-1" /> Verified</Badge>
            </div>
          )}
          {scanResult === 'error' && (
            <div className="absolute top-2 right-2">
              <Badge tone="danger"><XCircle size={10} className="mr-1" /> Invalid</Badge>
            </div>
          )}

          {/* Close button */}
          <button
            onClick={stopCamera}
            className="absolute top-2 left-2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70 transition-colors"
          >
            <CameraOff size={14} />
          </button>

          {verifyQr.isPending && (
            <div className="absolute bottom-2 left-2 right-2">
              <div className="rounded-lg bg-black/50 px-3 py-1.5 text-center">
                <p className="text-xs text-white/80">Verifying QR code...</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
