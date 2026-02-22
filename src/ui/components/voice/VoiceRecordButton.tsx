"use client";

import React, { useEffect } from "react";
import { Mic, MicOff, Square } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMediaRecorder, RecordingState } from "@/src/ui/hooks/use-media-recorder";

interface VoiceRecordButtonProps {
  onTranscription: (blob: Blob) => void;
  onStateChange?: (state: RecordingState) => void;
  className?: string;
}

export const VoiceRecordButton: React.FC<VoiceRecordButtonProps> = ({
  onTranscription,
  onStateChange,
  className = "",
}) => {
  const { state, start, stop } = useMediaRecorder(onTranscription);

  useEffect(() => {
    if (onStateChange) onStateChange(state);
  }, [state, onStateChange]);

  const toggleRecording = async () => {
    if (state === "recording") {
      stop();
    } else {
      await start();
    }
  };

  return (
    <div className={`relative ${className}`}>
      <AnimatePresence>
        {state === "recording" && (
          <motion.div
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.5, opacity: 0 }}
            exit={{ scale: 1, opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
            className="absolute inset-0 rounded-full bg-teal-500/30"
          />
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={toggleRecording}
        className={`relative z-10 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 shadow-lg backdrop-blur-md transition-colors ${
          state === "recording" 
            ? "bg-teal-500/30 text-teal-400 border-teal-500/50" 
            : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
        }`}
      >
        {state === "recording" ? (
          <Square className="h-6 w-6 fill-current" />
        ) : (
          <Mic className="h-7 w-7" />
        )}
      </motion.button>
    </div>
  );
};
