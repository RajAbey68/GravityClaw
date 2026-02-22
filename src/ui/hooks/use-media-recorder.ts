import { useState, useRef, useCallback } from "react";

export type RecordingState = "idle" | "recording" | "paused";

export interface UseMediaRecorderReturn {
  state: RecordingState;
  start: () => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  data: Blob | null;
}

export function useMediaRecorder(onDataAvailable?: (blob: Blob) => void): UseMediaRecorderReturn {
  const [state, setState] = useState<RecordingState>("idle");
  const [data, setData] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setData(blob);
        if (onDataAvailable) onDataAvailable(blob);
        // Stop all tracks to release the microphone
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setState("recording");
    } catch (error) {
      console.error("Failed to start recording:", error);
      throw error;
    }
  }, [onDataAvailable]);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current && state !== "idle") {
      mediaRecorderRef.current.stop();
      setState("idle");
    }
  }, [state]);

  const pause = useCallback(() => {
    if (mediaRecorderRef.current && state === "recording") {
      mediaRecorderRef.current.pause();
      setState("paused");
    }
  }, [state]);

  const resume = useCallback(() => {
    if (mediaRecorderRef.current && state === "paused") {
      mediaRecorderRef.current.resume();
      setState("recording");
    }
  }, [state]);

  return {
    state,
    start,
    stop,
    pause,
    resume,
    data,
  };
}
