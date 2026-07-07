'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Camera, CameraOff, Image, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface FaceCaptureProps {
  onCapture: (data: { faceEncoding: number[]; photoUrl?: string }) => void;
  onLivenessResult?: (result: { passed: boolean; method?: string }) => void;
  requireLiveness?: boolean;
  disabled?: boolean;
}

const ENCODING_SIZE = 64; // 8x8 grayscale downsample for the encoding vector

export default function FaceCapture({ onCapture, onLivenessResult, requireLiveness, disabled }: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [captured, setCaptured] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'capturing' | 'processing' | 'complete' | 'error'>('idle');
  const [message, setMessage] = useState('');

  // Check if face is enrolled
  const { data: enrollment } = useQuery({
    queryKey: ['face-enrollment'],
    queryFn: async () => {
      const res = await api.get('/attendance-security/face/enrollment');
      return res.data?.data || res.data;
    },
    retry: false,
  });

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 320, height: 240 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      setCaptured(false);
      setCapturedImage(null);
      setStatus('idle');
      setMessage('');
    } catch (err) {
      setMessage('Camera access denied. Please allow camera permissions.');
      setStatus('error');
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }

  function captureFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setStatus('capturing');

    // Capture a still frame
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    // Get the image data for encoding
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Generate face encoding (grayscale downsample to ENCODING_SIZE x ENCODING_SIZE)
    const encoding = generateFaceEncoding(imageData);

    // Create preview thumbnail
    const previewCanvas = previewRef.current;
    if (previewCanvas) {
      previewCanvas.width = 96;
      previewCanvas.height = 96;
      const pctx = previewCanvas.getContext('2d');
      if (pctx) {
        pctx.drawImage(canvas, 0, 0, 96, 96);
        setCapturedImage(previewCanvas.toDataURL('image/jpeg', 0.7));
      }
    }

    setStatus('processing');
    setCaptured(true);

    // Liveness check simulation (in production, use a proper SDK)
    if (requireLiveness) {
      // Simulated liveness - in production this would use a real liveness SDK
      const livenessPassed = true;
      const livenessMethod = 'blink-detection';
      onLivenessResult?.({ passed: livenessPassed, method: livenessMethod });
    }

    // Pass data back to parent
    onCapture({ faceEncoding: encoding });

    setStatus('complete');
    setMessage('Face captured successfully');
    setTimeout(() => setMessage(''), 3000);
  }

  /**
   * Generate a simple face encoding by:
   * 1. Downsampling to a small grayscale grid
   * 2. Normalizing pixel values
   * 3. Flattening into a 1D vector
   *
   * In production, replace this with a proper face recognition model
   * (e.g., TensorFlow.js FaceMesh, FaceIO, or a server-side API).
   */
  function generateFaceEncoding(imageData: ImageData): number[] {
    const { width, height, data } = imageData;
    const stepX = Math.max(1, Math.floor(width / ENCODING_SIZE));
    const stepY = Math.max(1, Math.floor(height / ENCODING_SIZE));
    const encoding: number[] = [];

    for (let y = 0; y < height; y += stepY) {
      for (let x = 0; x < width; x += stepX) {
        const idx = (y * width + x) * 4;
        // Convert to grayscale using luminance weights
        const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        // Normalize to [-1, 1]
        encoding.push((gray / 255) * 2 - 1);
      }
    }

    // Ensure we have exactly ENCODING_SIZE^2 values
    while (encoding.length < ENCODING_SIZE * ENCODING_SIZE) {
      encoding.push(0);
    }

    return encoding.slice(0, ENCODING_SIZE * ENCODING_SIZE);
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return (
    <div>
      {!cameraActive ? (
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-xl border-2 border-dashed border-ink-faint/30 p-6 text-center">
            <Camera size={40} className="mx-auto mb-2 text-ink-faint" />
            <p className="text-sm text-ink-faint mb-3">
              {enrollment ? 'Take a selfie for face verification' : 'No face enrolled yet'}
            </p>
            <Button
              variant="secondary"
              onClick={startCamera}
              disabled={disabled}
              size="sm"
            >
              <Camera size={14} className="mr-1" />
              Open Camera
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-xl bg-black">
            <video
              ref={videoRef}
              className="w-full h-40 object-cover"
              playsInline
              muted
            />
            <canvas ref={canvasRef} className="hidden" />
            <canvas ref={previewRef} className="hidden" />

            {/* Face guide overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="h-24 w-24 rounded-full border-2 border-emerald-400/60 opacity-50" />
            </div>

            {/* Status badge */}
            {status === 'complete' && (
              <div className="absolute top-2 right-2">
                <Badge tone="success"><CheckCircle size={10} className="mr-1" /> Captured</Badge>
              </div>
            )}
            {status === 'processing' && (
              <div className="absolute top-2 right-2">
                <Badge tone="warning">Processing...</Badge>
              </div>
            )}

            {/* Close */}
            <button
              onClick={stopCamera}
              className="absolute top-2 left-2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70 transition-colors"
            >
              <CameraOff size={14} />
            </button>
          </div>

          {capturedImage && (
            <div className="flex items-center gap-3">
              <img
                src={capturedImage}
                alt="Captured face"
                className="h-12 w-12 rounded-lg object-cover border border-border"
              />
              <div className="flex-1">
                <p className="text-xs font-medium text-ink">Face captured</p>
                <p className="text-xs text-ink-faint">
                  {ENCODING_SIZE}x{ENCODING_SIZE} encoding generated
                </p>
              </div>
              <Badge tone="success">Ready</Badge>
            </div>
          )}

          {!captured && (
            <Button
              onClick={captureFrame}
              size="sm"
              className="w-full"
              disabled={disabled}
            >
              <Image size={14} className="mr-1" />
              Capture & Verify Face
            </Button>
          )}

          {captured && (
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() => {
                setCaptured(false);
                setCapturedImage(null);
                setStatus('idle');
              }}
            >
              Retake
            </Button>
          )}

          {message && (
            <p className={`text-xs text-center ${status === 'error' ? 'text-red-500' : 'text-emerald-500'}`}>
              {message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
