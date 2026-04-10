import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Settings, 
  History, 
  Brain, 
  Sparkles, 
  Image as ImageIcon, 
  Video, 
  Music,
  Search,
  AlertCircle,
  Loader2,
  Moon,
  Sun,
  Power,
  Send,
  Plus
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { aatEngine } from '../lib/aatEngine';
import { MemoryManager } from '../lib/memory';

interface Message {
  role: 'user' | 'model';
  content: string;
  type?: 'text' | 'image' | 'video';
  url?: string;
}

export default function VoiceAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking' | 'sleeping'>('sleeping');
  const [lastTranscript, setLastTranscript] = useState("");
  const [isSinging, setIsSinging] = useState(false);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const [textInput, setTextInput] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const accumulatedTranscriptRef = useRef("");
  const isWakeWordTriggeredRef = useRef(false);
  const autoListenTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startListeningRef = useRef<() => void>(() => {});
  const stopListeningRef = useRef<() => void>(() => {});

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const handleToolCall = useCallback(async (name: string, args: any) => {
    console.log(`Executing tool: ${name}`, args);
    
    if (name === 'save_note') {
      await MemoryManager.addEntry({ type: 'note', content: args.content });
      loadMemory(); // Refresh memory entries immediately
      setMessages(prev => [...prev, { role: 'model', content: `[calm] I've added that to my memory: "${args.content}"` }]);
    } else if (name === 'generate_image') {
      const url = await aatEngine.generateImage(args.prompt);
      if (url) {
        setMessages(prev => [...prev, { role: 'model', content: `Generated image for: ${args.prompt}`, type: 'image', url }]);
      }
    } else if (name === 'generate_video') {
      const url = await aatEngine.generateVideo(args.prompt);
      if (url) {
        setMessages(prev => [...prev, { role: 'model', content: `Generated video for: ${args.prompt}`, type: 'video', url }]);
      }
    } else if (name === 'search_web') {
      setMessages(prev => [...prev, { role: 'model', content: `Searching the web for: ${args.query}...` }]);
      // In a real app, we'd call a search API. For now, we'll let Gemini handle the "search result" 
      // by providing the tool output back to the model if we were using function calling properly.
      // Since we are just logging it for now, we'll add a message.
    }
    // Add other tool handlers as needed
  }, []);

  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);

  const playNextInQueue = useCallback(async (setIdleAtEnd = true) => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    isPlayingRef.current = true;
    setStatus('speaking');

    while (audioQueueRef.current.length > 0) {
      const audioBuffer = audioQueueRef.current.shift();
      if (audioBuffer && audioContextRef.current) {
        await new Promise<void>((resolve) => {
          const source = audioContextRef.current!.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioContextRef.current!.destination);
          audioSourceRef.current = source;
          
          source.onended = () => {
            audioSourceRef.current = null;
            resolve();
          };
          source.start();
        });
      }
    }

    if (setIdleAtEnd) {
      setStatus('listening');
      startListeningRef.current();
      
      // Auto-off after 4 seconds if no speech detected
      if (autoListenTimerRef.current) clearTimeout(autoListenTimerRef.current);
      autoListenTimerRef.current = setTimeout(() => {
        if (status === 'listening' && !accumulatedTranscriptRef.current) {
          stopListeningRef.current();
          setStatus('idle');
        }
      }, 4000);
    }
    isPlayingRef.current = false;
  }, [status]);

  const fetchAndQueueAudio = useCallback(async (text: string, isLast: boolean) => {
    if (isMuted) return;
    
    try {
      if (audioContextRef.current?.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const base64Data = await aatEngine.generateSpeech(text);
      if (base64Data && audioContextRef.current) {
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const int16Array = new Int16Array(bytes.buffer);
        const float32Array = new Float32Array(int16Array.length);
        for (let i = 0; i < int16Array.length; i++) {
          float32Array[i] = int16Array[i] / 32768;
        }

        const audioBuffer = audioContextRef.current.createBuffer(1, float32Array.length, 24000);
        audioBuffer.getChannelData(0).set(float32Array);
        
        audioQueueRef.current.push(audioBuffer);
        playNextInQueue(isLast);
      } else {
        // Fallback to Web Speech Synthesis if Gemini TTS fails
        const cleanText = text
          .replace(/\[.*?\]/g, '')
          .replace(/\(.*?\)/g, '')
          .replace(/[♫♪*#_~`]/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (!cleanText) {
          if (isLast) setStatus('idle');
          return;
        }

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.0;
        utterance.pitch = 1.1; 
        
        const voices = window.speechSynthesis.getVoices();
        const isHindi = /[\u0900-\u097F]/.test(cleanText);

        if (isHindi) {
          const hindiVoice = voices.find(v => v.lang.startsWith('hi')) || 
                             voices.find(v => v.name.includes('Hindi'));
          if (hindiVoice) utterance.voice = hindiVoice;
        } else {
          // Priority list for female English voices
          const femaleVoice = 
                             voices.find(v => v.name.includes('Samantha')) ||
                             voices.find(v => v.name.includes('Victoria')) ||
                             voices.find(v => v.lang.startsWith('en') && (v.name.includes('Female') || v.name.includes('Soft')));
          if (femaleVoice) utterance.voice = femaleVoice;
        }

        utterance.onstart = () => {
          setStatus('speaking');
          isPlayingRef.current = true;
        };
        utterance.onend = () => {
          if (isLast) {
            setStatus('listening');
            startListeningRef.current();
            
            if (autoListenTimerRef.current) clearTimeout(autoListenTimerRef.current);
            autoListenTimerRef.current = setTimeout(() => {
              if (status === 'listening' && !accumulatedTranscriptRef.current) {
                stopListeningRef.current();
                setStatus('idle');
              }
            }, 4000);
          }
          isPlayingRef.current = false;
          playNextInQueue(isLast);
        };
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      console.error("Fetch Audio Error:", err);
      // Fallback on error
      const utterance = new SpeechSynthesisUtterance(text.replace(/^Say calm: /, ""));
      window.speechSynthesis.speak(utterance);
    }
  }, [isMuted, playNextInQueue]);

  const lastProcessedText = useRef("");
  const lastProcessedTime = useRef(0);

  const handleUserMessage = useCallback(async (text: string) => {
    const now = Date.now();
    if (!text.trim()) return;
    
    // Prevent duplicate processing of the same text within a short window
    if (text.trim().toLowerCase() === lastProcessedText.current.toLowerCase() && now - lastProcessedTime.current < 2000) {
      return;
    }
    
    lastProcessedText.current = text.trim();
    lastProcessedTime.current = now;
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current = null;
    }

    musicAudioRef.current?.pause();
    setIsSinging(false);
    audioQueueRef.current = [];
    isPlayingRef.current = false;

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setStatus('thinking');
    setIsProcessing(true);
    
    const newUserMessage: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, newUserMessage]);

    try {
      const history = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      }));

      const responseText = await aatEngine.process(text, history);
      
      if (abortController.signal.aborted) return;

      // If the response indicates a memory save, refresh the history bar
      if (responseText.includes("I've added that to my memory")) {
        loadMemory();
      }

      setIsSinging(responseText.includes('[singing]'));
      const modelMessage: Message = { role: 'model', content: responseText };
      setMessages(prev => [...prev, modelMessage]);
      
      // Pass the full text including emotional tags to the speech engine
      fetchAndQueueAudio(responseText, true);

    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error("Error processing message:", err);
      setMessages(prev => [...prev, { role: 'model', content: "I'm sorry, I encountered an error." }]);
    } finally {
      if (!abortController.signal.aborted) {
        setIsProcessing(false);
        if (!isPlayingRef.current && audioQueueRef.current.length === 0) {
          setStatus('idle');
        }
      }
    }
  }, [messages, isMuted, handleToolCall, fetchAndQueueAudio]);

  const onResult = useCallback((finalTranscript: string, interimTranscript: string) => {
    // Stop background work if user starts speaking while Aura is active
    if (interimTranscript && (status === 'speaking' || isSinging)) {
      musicAudioRef.current?.pause();
      setIsSinging(false);
      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
        audioSourceRef.current = null;
      }
      audioQueueRef.current = [];
      isPlayingRef.current = false;
      window.speechSynthesis.cancel();
      setStatus('listening');
    }

    if (status === 'sleeping') {
      if (isWakeWordTriggeredRef.current) return;
      
      const lowerTranscript = (finalTranscript || interimTranscript).toLowerCase();
      const wakeWords = ["hii friday", "hi friday", "wake up", "wake up friday", "hello friday", "aura", "ora", "hey aura", "hey ora", "hi aura", "hi ora"];
      
      if (wakeWords.some(word => lowerTranscript.includes(word))) {
        isWakeWordTriggeredRef.current = true;
        const hour = new Date().getHours();
        let greeting = "Good evening";
        if (hour < 12) greeting = "Good morning";
        else if (hour < 17) greeting = "Good afternoon";
        
        const response = `[calm] ${greeting} sir.`;
        const textResponse = `${greeting} sir.`;
        
        setStatus('idle');
        fetchAndQueueAudio(response, true);
        setMessages(prev => [...prev, { role: 'model', content: textResponse }]);
        
        // Reset the trigger ref after a short delay
        setTimeout(() => {
          isWakeWordTriggeredRef.current = false;
        }, 2000);
      }
      return;
    }

    if (status === 'listening') {
      if (autoListenTimerRef.current) {
        clearTimeout(autoListenTimerRef.current);
        autoListenTimerRef.current = null;
      }

      if (finalTranscript) {
        accumulatedTranscriptRef.current += " " + finalTranscript;
      }
      
      setLastTranscript(accumulatedTranscriptRef.current + " " + interimTranscript);

      // Local "Stop" detection for instant cutoff
      const currentTranscript = (accumulatedTranscriptRef.current + " " + interimTranscript).toLowerCase().trim();
      if (currentTranscript === "stop" || currentTranscript === "stop music" || currentTranscript === "shut up") {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        musicAudioRef.current?.pause();
        setIsSinging(false);
        if (audioSourceRef.current) {
          audioSourceRef.current.stop();
          audioSourceRef.current = null;
        }
        audioQueueRef.current = [];
        isPlayingRef.current = false;
        window.speechSynthesis.cancel();
        accumulatedTranscriptRef.current = "";
        setLastTranscript("");
        stopListeningRef.current();
        setStatus('idle');
        setMessages(prev => [...prev, { role: 'model', content: "Stopping all systems." }]);
        return;
      }

      // Reset silence timer on any activity
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      
      silenceTimerRef.current = setTimeout(() => {
        const finalCommand = (accumulatedTranscriptRef.current + " " + interimTranscript).trim();
        if (finalCommand) {
          handleUserMessage(finalCommand);
          accumulatedTranscriptRef.current = "";
          stopListeningRef.current();
          setStatus('idle');
        }
      }, 1500); // Reduced to 1.5 seconds for much faster response
    }
  }, [status, handleUserMessage, isMuted, fetchAndQueueAudio, isSinging]);


  const onEnd = useCallback(() => {
    if (status === 'listening') {
      setStatus('idle');
    }
  }, [status]);

  const { isListening, startListening, stopListening, error: sttError } = useSpeechRecognition({
    onResult,
    onEnd,
    continuous: true
  });

  const initializeAudio = async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    
    setHasInteracted(true);
    
    // Ensure listening is active
    if (!isListening) {
      startListening();
    }
    
    const response = "[happy] System initialized. Aura is online and listening.";
    const textResponse = "System initialized. Aura is online and listening.";
    fetchAndQueueAudio(response, true);
    setMessages([{ role: 'model', content: textResponse }]);
    setStatus('sleeping');
  };

  // Automatically start listening for wake word as soon as possible
  useEffect(() => {
    if (!isListening && status === 'sleeping') {
      try {
        startListening();
      } catch (e) {
        // Silent fail if browser blocks auto-start
      }
    }
  }, [isListening, startListening, status]);

  useEffect(() => {
    startListeningRef.current = startListening;
    stopListeningRef.current = stopListening;
  }, [startListening, stopListening]);

  const toggleListening = () => {
    if (status === 'listening') {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      const finalCommand = accumulatedTranscriptRef.current.trim();
      if (finalCommand) {
        handleUserMessage(finalCommand);
      }
      accumulatedTranscriptRef.current = "";
      stopListening();
      setStatus('idle');
    } else if (status !== 'sleeping' && !isProcessing) {
      // Stop all background work when starting to listen
      musicAudioRef.current?.pause();
      setIsSinging(false);
      if (audioSourceRef.current) {
        audioSourceRef.current.stop();
        audioSourceRef.current = null;
      }
      audioQueueRef.current = [];
      isPlayingRef.current = false;
      window.speechSynthesis.cancel();

      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
      accumulatedTranscriptRef.current = "";
      startListening();
      setStatus('listening');
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim() && !isProcessing) {
      if (status === 'sleeping') setStatus('idle');
      const query = isSearchMode ? `Search the web for: ${textInput.trim()}` : textInput.trim();
      handleUserMessage(query);
      setTextInput("");
      setIsSearchMode(false);
    }
  };

  const [showHistory, setShowHistory] = useState(false);
  const [engineMode, setEngineMode] = useState<string>('Initializing AAT...');
  const [memoryEntries, setMemoryEntries] = useState<any[]>([]);

  useEffect(() => {
    if (isSinging && !isMuted) {
      if (!musicAudioRef.current) {
        musicAudioRef.current = new Audio('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3');
        musicAudioRef.current.loop = true;
        musicAudioRef.current.volume = 0.2;
      }
      musicAudioRef.current.play().catch(() => {});
    } else {
      musicAudioRef.current?.pause();
    }
  }, [isSinging, isMuted]);

  useEffect(() => {
    if (status !== 'speaking') {
      setIsSinging(false);
    }
  }, [status]);

  useEffect(() => {
    if (showHistory) {
      loadMemory();
    }
  }, [showHistory]);

  useEffect(() => {
    const initEngine = async () => {
      await aatEngine.initialize();
      setEngineMode(aatEngine.status);
      loadMemory(); // Load memory on mount to show indicator
    };
    initEngine();
  }, []);

  const loadMemory = async () => {
    const entries = await MemoryManager.getAllEntries();
    setMemoryEntries(entries.reverse());
  };

  const clearMemory = async () => {
    if (confirm("Are you sure you want to clear all personal memory? This cannot be undone.")) {
      await MemoryManager.clearMemory();
      setMemoryEntries([]);
      setMessages(prev => [...prev, { role: 'model', content: "Memory cleared successfully." }]);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0a0502] text-white font-sans selection:bg-orange-500/30 overflow-hidden flex flex-col">
      {/* Atmospheric Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,#3a1510_0%,transparent_60%)] opacity-80 blur-[60px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_80%,#ff4e00_0%,transparent_50%)] opacity-40 blur-[60px]" />
      </div>

      {!hasInteracted ? (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-50 bg-[#0a0502] flex flex-col items-center justify-center p-8 text-center"
        >
          {/* Animated Logo */}
          <div className="relative w-48 h-48 flex items-center justify-center mb-12">
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, 90, 180, 270, 360],
                borderRadius: ["30%", "50%", "30%"],
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "linear"
              }}
              className="absolute inset-0 bg-orange-500/10 border border-orange-500/20 blur-xl"
            />
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                boxShadow: [
                  "0 0 20px rgba(249,115,22,0.2)",
                  "0 0 50px rgba(249,115,22,0.5)",
                  "0 0 20px rgba(249,115,22,0.2)"
                ]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="relative z-10 w-24 h-24 bg-orange-500 rounded-[24px] flex items-center justify-center"
            >
              <Brain className="w-12 h-12 text-white" />
            </motion.div>
            
            {/* Orbiting particles */}
            {[0, 120, 240].map((angle, i) => (
              <motion.div
                key={i}
                animate={{
                  rotate: [angle, angle + 360],
                }}
                transition={{
                  duration: 10 + i * 2,
                  repeat: Infinity,
                  ease: "linear"
                }}
                className="absolute w-full h-full"
              >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-orange-500/40 rounded-full blur-[1px]" />
              </motion.div>
            ))}
          </div>

          {/* Typewriter Text */}
          <div className="mb-12 h-8 flex items-center justify-center">
            <motion.h2 
              className="text-4xl font-bold tracking-[0.3em] text-white flex"
            >
              {"AURA".split("").map((char, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.5,
                    delay: i * 0.2,
                    ease: "easeOut"
                  }}
                >
                  {char}
                </motion.span>
              ))}
            </motion.h2>
          </div>

          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="text-[10px] font-mono text-white/30 mb-12 uppercase tracking-[0.4em]"
          >
            Neural Interface Ready
          </motion.p>

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2 }}
            onClick={initializeAudio}
            className="group relative flex items-center gap-4 px-10 py-5 bg-white text-black rounded-2xl font-bold uppercase tracking-[0.2em] text-[10px] transition-all hover:scale-105 active:scale-95 overflow-hidden"
          >
            <span className="relative z-10">Initialize System</span>
            <motion.div 
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500/20 to-transparent"
            />
          </motion.button>
        </motion.div>
      ) : null}

      {/* Header */}
      <header className="relative z-10 p-6 flex items-center justify-between border-b border-white/5 bg-[#151619]/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
            <Brain className="w-5 h-5 text-orange-500" />
          </div>
          <h1 className="text-sm font-bold tracking-[0.2em] text-white">AURA</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowHistory(true)}
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors relative"
            title="History"
          >
            <History className="w-5 h-5 text-white/60" />
            {memoryEntries.length > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-orange-500 rounded-full border-2 border-[#151619]" />
            )}
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-6 space-y-6 relative z-10 scroll-smooth">
        <AnimatePresence mode="popLayout">
          {messages.length === 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-40"
            >
              <Sparkles className="w-12 h-12 text-orange-500/50" />
              <p className="text-sm font-mono tracking-widest uppercase">Aura is ready to assist</p>
              <p className="text-xs italic">"Hey Aura, remember my favorite color is blue"</p>
            </motion.div>
          )}
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20, y: 10 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              className={cn(
                "flex w-full",
                msg.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              <div className={cn(
                "max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-lg",
                msg.role === 'user' 
                  ? "bg-orange-500 text-white rounded-tr-none" 
                  : "bg-white/5 border border-white/10 text-white/90 rounded-tl-none"
              )}>
                {msg.content}
                {msg.type === 'image' && msg.url && (
                  <img src={msg.url} alt="Generated" className="mt-3 rounded-xl w-full object-cover shadow-inner" referrerPolicy="no-referrer" />
                )}
                {msg.type === 'video' && msg.url && (
                  <video src={msg.url} controls className="mt-3 rounded-xl w-full shadow-inner" />
                )}
              </div>
            </motion.div>
          ))}
          {isProcessing && (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex justify-start"
            >
              <div className="bg-white/5 border border-white/10 p-4 rounded-2xl rounded-tl-none flex items-center gap-3">
                <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />
                <span className="text-xs font-mono text-white/40 uppercase tracking-widest">Aura is thinking...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="h-4" /> {/* Spacer */}
      </main>

      {/* Bottom Input Bar */}
      <footer className="relative z-10 p-4 bg-[#151619]/80 backdrop-blur-xl border-t border-white/5">
        <form onSubmit={handleTextSubmit} className="max-w-4xl mx-auto flex items-center gap-3">
          <button
            type="button"
            className="p-3 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white/60 transition-all active:scale-95"
            title="Add Photo"
          >
            <Plus className="w-5 h-5" />
          </button>
          
          <div className="flex-1 relative">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Message Aura..."
              disabled={isProcessing}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:border-orange-500/50 transition-all pr-24"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsSearchMode(!isSearchMode)}
                className={cn(
                  "p-2 transition-colors",
                  isSearchMode ? "text-blue-400" : "text-white/20 hover:text-white/40"
                )}
                title="Web Search"
              >
                <Search className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={toggleListening}
                className={cn(
                  "p-2 rounded-lg transition-all",
                  status === 'listening' ? "text-orange-500 bg-orange-500/10" : "text-white/20 hover:text-white/40"
                )}
                title="Voice Input"
              >
                {status === 'listening' ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={!textInput.trim() || isProcessing}
            className="p-3.5 rounded-xl bg-orange-500 text-white disabled:opacity-50 disabled:bg-white/5 disabled:text-white/20 transition-all active:scale-95 shadow-lg shadow-orange-500/20"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </footer>

      {/* Memory Modal */}
      <AnimatePresence>
        {showHistory && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md bg-[#151619] rounded-[32px] border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <h2 className="text-sm font-medium tracking-tight uppercase">Personal Memory</h2>
                <button 
                  onClick={() => setShowHistory(false)}
                  className="text-xs text-white/40 hover:text-white"
                >
                  Close
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {memoryEntries.length === 0 ? (
                  <p className="text-sm text-white/20 text-center py-8 italic">No memories stored yet.</p>
                ) : (
                  memoryEntries.map((entry, i) => (
                    <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono text-orange-500/60 uppercase">{entry.type}</span>
                        <span className="text-[10px] font-mono text-white/20">{new Date(entry.timestamp).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-white/80">{entry.content}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="p-6 border-t border-white/5">
                <button 
                  onClick={clearMemory}
                  className="w-full py-3 rounded-xl bg-red-500/10 text-red-500 text-xs font-medium uppercase tracking-wider hover:bg-red-500/20 transition-colors"
                >
                  Clear All Memory
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Footer Info */}
      <div className="mt-8 text-center">
        <p className="text-[10px] font-mono text-white/20 uppercase tracking-[0.2em]">
          Designed for Privacy & Performance
        </p>
      </div>
    </div>
  );
}
