"use client";

import React, { useState, useEffect, useRef } from "react";
import { useControlStore } from "@/src/ui/state/control-store";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, X, Volume2, Loader2, Sparkles } from "lucide-react";
import { VoiceRecordButton } from "./VoiceRecordButton";

export const TalkMode: React.FC = () => {
  const { isTalkModeOpen, setTalkModeOpen, selectedAgentId, workspaceId } = useControlStore();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!isTalkModeOpen) {
      setIsRecording(false);
      setIsProcessing(false);
      setIsAgentSpeaking(false);
      setTranscript("");
    }
  }, [isTalkModeOpen]);

  const handleTranscribe = async (blob: Blob) => {
    setIsProcessing(true);
    const formData = new FormData();
    formData.append("audio", blob);
    formData.append("agentId", selectedAgentId || "main");

    try {
      const response = await fetch("/api/voice/transcribe", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (data.text) {
        setTranscript(data.text);
        // Here we would normally send the text to the orchestrator/agent
        // For Phase 8 skeleton, we'll just show the transcript
      }
    } catch (error) {
      console.error("Transcription failed:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isTalkModeOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md"
      >
        <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-black/40 p-8 shadow-2xl backdrop-blur-2xl">
          {/* Header */}
          <div className="mb-12 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-500/20 shadow-[0_0_15px_rgba(20,184,166,0.3)]">
                <Sparkles className="h-5 w-5 text-teal-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Quantum Link</h2>
                <p className="text-sm text-white/50">Bidirectional Voice Stream Active</p>
              </div>
            </div>
            <button
              onClick={() => setTalkModeOpen(false)}
              className="rounded-full p-2 text-white/40 hover:bg-white/5 hover:text-white"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Central Visualization Area */}
          <div className="flex flex-col items-center justify-center py-12">
            <div className="relative mb-8 flex h-48 w-48 items-center justify-center">
              {/* Outer Pulse Rings */}
              <AnimatePresence>
                {(isRecording || isAgentSpeaking) && (
                  <>
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1.5, opacity: 0.1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                      className={`absolute inset-0 rounded-full ${isAgentSpeaking ? 'bg-purple-500' : 'bg-teal-500'}`}
                    />
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1.8, opacity: 0.05 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
                      className={`absolute inset-0 rounded-full ${isAgentSpeaking ? 'bg-purple-500' : 'bg-teal-500'}`}
                    />
                  </>
                )}
              </AnimatePresence>

              {/* Central Orb */}
              <motion.div
                animate={{
                  scale: isRecording || isAgentSpeaking ? [1, 1.05, 1] : 1,
                  boxShadow: isRecording 
                    ? "0 0 30px rgba(20,184,166,0.4)" 
                    : isAgentSpeaking 
                      ? "0 0 30px rgba(168,85,247,0.4)" 
                      : "0 0 0px rgba(0,0,0,0)"
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className={`relative z-10 flex h-32 w-32 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br ${
                  isRecording 
                    ? 'from-teal-500/30 to-teal-900/40' 
                    : isAgentSpeaking 
                      ? 'from-purple-500/30 to-purple-900/40' 
                      : 'from-white/5 to-white/10'
                } backdrop-blur-xl shadow-inner`}
              >
                {isProcessing ? (
                  <Loader2 className="h-10 w-10 animate-spin text-teal-400" />
                ) : isAgentSpeaking ? (
                  <Volume2 className="h-10 w-10 text-purple-400" />
                ) : (
                  <Mic className={`h-10 w-10 ${isRecording ? 'text-teal-400' : 'text-white/40'}`} />
                )}
              </motion.div>
            </div>

            {/* Status Text */}
            <div className="text-center">
              <h3 className="text-lg font-medium text-white mb-2">
                {isProcessing ? "Analyzing Neural Patterns..." : isRecording ? "Listening..." : isAgentSpeaking ? "Transmitting..." : "Ready for Input"}
              </h3>
              <p className="mx-auto max-w-xs text-sm text-white/40">
                {transcript || "Speak clearly to interact with the neural collective."}
              </p>
            </div>
          </div>

          {/* Controls Footer */}
          <div className="mt-12 flex items-center justify-center gap-6">
            <VoiceRecordButton 
              onTranscription={handleTranscribe} 
              onStateChange={(state: any) => setIsRecording(state === 'recording')}
            />
          </div>

          <audio ref={audioRef} className="hidden" />
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
