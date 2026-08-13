import { useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import {
  cameraErrorMessage,
  createScanGate,
  stopMediaStream,
} from "./scanner-utils";

interface NativeBarcode {
  rawValue: string;
}

interface NativeBarcodeDetector {
  detect(source: HTMLVideoElement): Promise<NativeBarcode[]>;
}

interface BarcodeDetectorConstructor {
  new (options: { formats: string[] }): NativeBarcodeDetector;
  getSupportedFormats?: () => Promise<string[]>;
}

export function QrScanner({
  onDetected,
  onError,
}: {
  onDetected: (value: string) => void;
  onError: (message: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const frameRef = useRef<number | null>(null);
  const gateRef = useRef(createScanGate());
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [readingImage, setReadingImage] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  function stop() {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    controlsRef.current?.stop();
    controlsRef.current = null;
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
    setTorchAvailable(false);
    setTorchOn(false);
  }

  async function accept(value: string) {
    if (!gateRef.current.accept(value)) return;
    if (navigator.vibrate) navigator.vibrate(80);
    stop();
    onDetected(value);
  }

  async function scanWithNative(video: HTMLVideoElement) {
    const Detector = (
      window as typeof window & {
        BarcodeDetector?: BarcodeDetectorConstructor;
      }
    ).BarcodeDetector;
    if (!Detector) return false;
    let detector: NativeBarcodeDetector;
    try {
      const formats = await Detector.getSupportedFormats?.();
      if (formats && !formats.includes("qr_code")) return false;
      detector = new Detector({ formats: ["qr_code"] });
    } catch {
      return false;
    }
    const scan = async () => {
      if (!streamRef.current || gateRef.current.paused) return;
      try {
        const [result] = await detector.detect(video);
        if (result?.rawValue) {
          await accept(result.rawValue);
          return;
        }
      } catch {
        // A frame can fail while the camera is warming up.
      }
      frameRef.current = requestAnimationFrame(() => void scan());
    };
    frameRef.current = requestAnimationFrame(() => void scan());
    return true;
  }

  async function start(selectedDeviceId = deviceId) {
    stop();
    gateRef.current.reset();
    setStarting(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        onError(
          "La cámara no está disponible en este navegador. Abre el sitio con HTTPS o ingresa el enlace manualmente.",
        );
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId } }
          : { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stopMediaStream(stream);
        return;
      }
      video.srcObject = stream;
      await video.play();
      const track = stream.getVideoTracks()[0];
      const capabilities = track?.getCapabilities?.() as
        | (MediaTrackCapabilities & { torch?: boolean })
        | undefined;
      setTorchAvailable(Boolean(capabilities?.torch));
      const cameras = navigator.mediaDevices.enumerateDevices
        ? (await navigator.mediaDevices.enumerateDevices()).filter(
            (device) => device.kind === "videoinput",
          )
        : [];
      setDevices(cameras);
      const settings = track?.getSettings?.();
      if (!selectedDeviceId && settings?.deviceId)
        setDeviceId(settings.deviceId);
      setActive(true);

      if (!(await scanWithNative(video))) {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        const reader = new BrowserQRCodeReader(undefined, {
          delayBetweenScanAttempts: 100,
          delayBetweenScanSuccess: 500,
        });
        controlsRef.current = await reader.decodeFromStream(
          stream,
          video,
          (result) => {
            if (result) void accept(result.getText());
          },
        );
      }
    } catch (error) {
      stop();
      onError(cameraErrorMessage(error));
    } finally {
      setStarting(false);
    }
  }

  async function toggleTorch() {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      });
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
    }
  }

  async function scanImage(file: File | undefined) {
    if (!file) return;
    setReadingImage(true);
    const url = URL.createObjectURL(file);
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const result = await new BrowserQRCodeReader().decodeFromImageUrl(url);
      await accept(result.getText());
    } catch {
      onError(
        "No encontramos un código QR legible en la imagen. Intenta con otra foto o ingresa el enlace manualmente.",
      );
    } finally {
      URL.revokeObjectURL(url);
      setReadingImage(false);
    }
  }

  useEffect(() => () => stop(), []);

  return (
    <div className="qr-scanner">
      <div className="scanner-viewport">
        <video ref={videoRef} muted playsInline aria-label="Vista de cámara" />
        <div className="scanner-frame" aria-hidden="true">
          <i /><i /><i /><i />
        </div>
        {!active && (
          <div className="scanner-permission">
            <img src="/white-simple.png" alt="" />
            <strong>Escanea el QR del cliente</strong>
            <p>La cámara se usará únicamente durante este escaneo.</p>
            <button type="button" onClick={() => void start()} disabled={starting || readingImage}>
              {starting ? "Solicitando permiso…" : "Activar cámara"}
            </button>
            <label className="scanner-image-action">
              {readingImage ? "Leyendo imagen…" : "Tomar o elegir foto del QR"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                disabled={starting || readingImage}
                onChange={(event) => {
                  void scanImage(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
        )}
      </div>
      {active && (
        <div className="scanner-controls">
          {devices.length > 1 && (
            <label>
              Cámara
              <select
                value={deviceId}
                onChange={(event) => {
                  setDeviceId(event.target.value);
                  void start(event.target.value);
                }}
              >
                {devices.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Cámara ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>
          )}
          {torchAvailable && (
            <button type="button" onClick={() => void toggleTorch()}>
              {torchOn ? "Apagar linterna" : "Encender linterna"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
