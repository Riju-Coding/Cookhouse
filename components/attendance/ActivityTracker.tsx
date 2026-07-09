"use client";

import { useAuth } from "@/hooks/use-auth";
import { useActivityTracker } from "@/hooks/useActivityTracker";
import { usePermissionTracker } from "@/hooks/usePermissionTracker";
import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ActivityTracker() {
  const { loginSessionId } = useAuth();
  const { showSelfiePrompt, submitSelfie } = useActivityTracker({
    sessionId: loginSessionId,
    idleTimeoutMinutes: 5,
    heartbeatIntervalSeconds: 60,
    minSelfieIntervalMinutes: 120, // Prompt roughly every 2-4 hours
    maxSelfieIntervalMinutes: 240,
  });

  usePermissionTracker({ sessionId: loginSessionId });

  return (
    <>
      {showSelfiePrompt && (
        <SelfieModal onSubmit={submitSelfie} />
      )}
    </>
  );
}

function SelfieModal({ onSubmit }: { onSubmit: (base64: string) => Promise<void> }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Unable to access camera. Please allow camera permissions to continue.");
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext("2d");
      if (context) {
        // Set canvas dimensions to match video
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        
        // Draw image
        context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
        
        // Get base64 string
        const base64Image = canvasRef.current.toDataURL("image/jpeg", 0.8);
        setCapturedImage(base64Image);
        
        // Stop camera
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
          setStream(null);
        }
      }
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
  };

  const handleSubmit = async () => {
    if (!capturedImage) return;
    setIsSubmitting(true);
    try {
      await onSubmit(capturedImage);
    } catch (err) {
      console.error(err);
      setError("Failed to upload selfie. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Activity Check-in</h2>
          <p className="text-muted-foreground mt-2">
            Please take a quick selfie to verify your active session.
          </p>
        </div>

        {error && (
          <div className="bg-destructive/15 text-destructive p-3 rounded-md text-sm text-center">
            {error}
          </div>
        )}

        <div className="relative aspect-video bg-muted rounded-lg overflow-hidden border">
          {!capturedImage ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
            </>
          ) : (
            <img src={capturedImage} alt="Captured selfie" className="w-full h-full object-cover" />
          )}
        </div>

        <div className="flex justify-center gap-4">
          {!capturedImage ? (
            <Button onClick={capturePhoto} className="w-full" size="lg" disabled={!stream}>
              <Camera className="w-4 h-4 mr-2" />
              Capture Photo
            </Button>
          ) : (
            <>
              <Button onClick={retakePhoto} variant="outline" className="flex-1" disabled={isSubmitting}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retake
              </Button>
              <Button onClick={handleSubmit} className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
