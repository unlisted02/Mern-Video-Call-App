import { useEffect, useMemo, useRef, useState } from "react";
import { SelfieSegmentation } from "@mediapipe/selfie_segmentation";
import { AlertTriangleIcon, CheckCircle2Icon, Loader2Icon, VideoIcon, XIcon } from "lucide-react";
import toast from "react-hot-toast";
import BackgroundEffectsPanel from "./BackgroundEffectsPanel";

function getPreviewStyle(preference) {
  if (preference?.type === "blur") {
    const strength = preference?.value?.strength || "low";
    const blurByStrength = { low: 2, medium: 4, high: 7 };
    return { filter: `blur(${blurByStrength[strength]}px)` };
  }

  return {};
}

function PreCallPreviewModal({
  isOpen,
  selectedPreference,
  onSelectPreference,
  onSaveDefault,
  isSavingDefault,
  onConfirm,
  onClose,
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const segmentationRef = useRef(null);
  const animationFrameRef = useRef(null);
  const personCanvasRef = useRef(null);
  const personCtxRef = useRef(null);
  const maskProbeCanvasRef = useRef(null);
  const maskProbeCtxRef = useRef(null);
  const [isLoadingCamera, setIsLoadingCamera] = useState(false);
  const [isSegmentationReady, setIsSegmentationReady] = useState(false);
  const [performanceStatus, setPerformanceStatus] = useState("checking");
  const [performanceMessage, setPerformanceMessage] = useState("Checking preview performance...");

  const showBackgroundImage =
    selectedPreference?.type === "unsplash" || selectedPreference?.type === "upload";
  const backgroundImageUrl = selectedPreference?.value?.imageUrl || selectedPreference?.value?.thumbUrl;

  useEffect(() => {
    if (!isOpen) return undefined;

    const startPreview = async () => {
      setIsLoadingCamera(true);
      setPerformanceStatus("checking");
      setPerformanceMessage("Checking preview performance...");

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        await assessPerformance();
      } catch (error) {
        toast.error("Camera preview failed to start");
        setPerformanceStatus("limited");
        setPerformanceMessage("Camera permission denied or unavailable.");
        console.error("Failed to initialize camera preview:", error);
      } finally {
        setIsLoadingCamera(false);
      }
    };

    startPreview();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (segmentationRef.current) {
        segmentationRef.current.close();
        segmentationRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      setIsSegmentationReady(false);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !showBackgroundImage || !videoRef.current || !canvasRef.current) return undefined;

    let cancelled = false;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return undefined;

    const segmentation = new SelfieSegmentation({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
    });
    segmentationRef.current = segmentation;
    segmentation.setOptions({ modelSelection: 1, selfieMode: true });

    segmentation.onResults((results) => {
      if (cancelled || !canvasRef.current) return;

      const width = canvasRef.current.width;
      const height = canvasRef.current.height;
      if (!personCanvasRef.current) {
        personCanvasRef.current = document.createElement("canvas");
      }
      if (!personCtxRef.current) {
        personCtxRef.current = personCanvasRef.current.getContext("2d");
      }
      const personCanvas = personCanvasRef.current;
      const personCtx = personCtxRef.current;
      if (!personCtx) return;
      if (!maskProbeCanvasRef.current) {
        maskProbeCanvasRef.current = document.createElement("canvas");
      }
      if (!maskProbeCtxRef.current) {
        maskProbeCtxRef.current = maskProbeCanvasRef.current.getContext("2d", { willReadFrequently: true });
      }
      const maskProbeCanvas = maskProbeCanvasRef.current;
      const maskProbeCtx = maskProbeCtxRef.current;
      if (!maskProbeCtx) return;

      personCanvas.width = width;
      personCanvas.height = height;
      personCtx.clearRect(0, 0, width, height);
      maskProbeCanvas.width = 64;
      maskProbeCanvas.height = 36;
      maskProbeCtx.clearRect(0, 0, maskProbeCanvas.width, maskProbeCanvas.height);
      maskProbeCtx.drawImage(results.segmentationMask, 0, 0, maskProbeCanvas.width, maskProbeCanvas.height);

      const maskPixels = maskProbeCtx.getImageData(0, 0, maskProbeCanvas.width, maskProbeCanvas.height).data;
      let brightTotal = 0;
      for (let index = 0; index < maskPixels.length; index += 4) {
        brightTotal += maskPixels[index];
      }
      const averageMaskBrightness = brightTotal / (maskPixels.length / 4);
      const maskLooksInvalid = averageMaskBrightness < 8 || averageMaskBrightness > 247;

      // Build person-only layer from camera frame + segmentation mask.
      if (!maskLooksInvalid) {
        personCtx.drawImage(results.image, 0, 0, width, height);
        personCtx.globalCompositeOperation = "destination-in";
        personCtx.drawImage(results.segmentationMask, 0, 0, width, height);
        personCtx.globalCompositeOperation = "source-over";
      }

      // Keep canvas transparent and let the DOM background image layer show through.
      ctx.clearRect(0, 0, width, height);

      // Draw person cutout when mask is usable; otherwise fallback to full camera frame.
      if (!maskLooksInvalid) {
        ctx.drawImage(personCanvas, 0, 0, width, height);
      } else {
        ctx.drawImage(results.image, 0, 0, width, height);
      }
    });

    const processFrame = async () => {
      if (cancelled || !videoRef.current || !segmentationRef.current) return;
      if (videoRef.current.readyState >= 2) {
        const videoWidth = videoRef.current.videoWidth;
        const videoHeight = videoRef.current.videoHeight;
        if (videoWidth > 0 && videoHeight > 0) {
          if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
            canvas.width = videoWidth;
            canvas.height = videoHeight;
          }

          try {
            await segmentationRef.current.send({ image: videoRef.current });
            setIsSegmentationReady(true);
          } catch {
            setIsSegmentationReady(false);
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(processFrame);
    };

    processFrame();

    return () => {
      cancelled = true;
      setIsSegmentationReady(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (segmentationRef.current) {
        segmentationRef.current.close();
        segmentationRef.current = null;
      }
    };
  }, [isOpen, showBackgroundImage]);

  const assessPerformance = async () => {
    let frames = 0;
    const start = performance.now();

    return new Promise((resolve) => {
      const tick = () => {
        frames += 1;
        const elapsed = performance.now() - start;
        if (elapsed >= 2000) {
          const fps = (frames * 1000) / elapsed;
          if (fps < 18) {
            setPerformanceStatus("limited");
            setPerformanceMessage("Performance limited. Consider blur low or none for smoother video.");
          } else {
            setPerformanceStatus("ready");
            setPerformanceMessage("Effect ready. You can proceed to the call.");
          }
          resolve(fps);
          return;
        }
        window.requestAnimationFrame(tick);
      };
      window.requestAnimationFrame(tick);
    });
  };

  const autoAdjustedPreference = useMemo(() => {
    if (performanceStatus !== "limited") return selectedPreference;
    if (selectedPreference?.type === "blur" && selectedPreference?.value?.strength === "high") {
      return { type: "blur", value: { strength: "medium" } };
    }
    return selectedPreference;
  }, [performanceStatus, selectedPreference]);

  useEffect(() => {
    if (!autoAdjustedPreference) return;
    if (
      autoAdjustedPreference.type !== selectedPreference?.type ||
      autoAdjustedPreference.value?.strength !== selectedPreference?.value?.strength
    ) {
      onSelectPreference(autoAdjustedPreference);
    }
  }, [autoAdjustedPreference, onSelectPreference, selectedPreference]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-base-200 border border-base-300 rounded-xl w-full max-w-5xl max-h-[95vh] overflow-auto">
        <div className="p-5 border-b border-base-300 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <VideoIcon className="size-5 text-primary" />
            Pre-call Preview
          </h2>
          <div className="flex items-center gap-2">
            <div
              className={`badge ${
                performanceStatus === "ready"
                  ? "badge-success"
                  : performanceStatus === "limited"
                    ? "badge-warning"
                    : "badge-neutral"
              }`}
            >
              {performanceStatus === "ready"
                ? "Effect Ready"
                : performanceStatus === "limited"
                  ? "Performance Limited"
                  : "Checking"}
            </div>
            <button className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Close preview">
              <XIcon className="size-4" />
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-5 p-5">
          <div className="space-y-4">
            <div className="rounded-xl overflow-hidden border border-base-300 bg-black relative aspect-video">
              {showBackgroundImage && backgroundImageUrl ? (
                <img
                  src={backgroundImageUrl}
                  alt="Background preview"
                  className="absolute inset-0 w-full h-full object-cover z-0"
                />
              ) : null}
              {isLoadingCamera ? (
                <div className="absolute inset-0 z-20 flex items-center justify-center">
                  <Loader2Icon className="size-6 animate-spin text-white" />
                </div>
              ) : null}
              {showBackgroundImage ? (
                <canvas
                  ref={canvasRef}
                  className={`absolute inset-0 w-full h-full object-cover z-10 ${
                    isSegmentationReady ? "block" : "hidden"
                  }`}
                />
              ) : null}
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={`absolute inset-0 w-full h-full object-cover z-0 ${
                  showBackgroundImage ? "opacity-0 pointer-events-none" : ""
                }`}
                style={showBackgroundImage ? undefined : getPreviewStyle(selectedPreference)}
              />
              {showBackgroundImage ? (
                !isSegmentationReady && (
                  <div className="absolute inset-0 z-20 bg-black/60 flex items-center justify-center">
                    <span className="text-sm text-white flex items-center gap-2">
                      <Loader2Icon className="size-4 animate-spin" />
                      Preparing virtual background...
                    </span>
                  </div>
                )
              ) : null}
            </div>

            <div
              className={`alert ${
                performanceStatus === "limited" ? "alert-warning" : "alert-success"
              }`}
            >
              {performanceStatus === "limited" ? (
                <AlertTriangleIcon className="size-4" />
              ) : (
                <CheckCircle2Icon className="size-4" />
              )}
              <span>{performanceMessage}</span>
            </div>

            <button className="btn btn-primary w-full" onClick={onConfirm} disabled={isLoadingCamera}>
              Confirm & Join Call
            </button>
          </div>

          <BackgroundEffectsPanel
            selectedPreference={selectedPreference}
            onSelectPreference={onSelectPreference}
            onSaveDefault={onSaveDefault}
            isSavingDefault={isSavingDefault}
          />
        </div>
      </div>
    </div>
  );
}

export default PreCallPreviewModal;
