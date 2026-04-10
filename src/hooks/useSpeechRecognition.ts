import { useState, useEffect, useCallback, useRef } from 'react';

interface UseSpeechRecognitionProps {
  onResult: (finalTranscript: string, interimTranscript: string) => void;
  onEnd?: () => void;
  continuous?: boolean;
  interimResults?: boolean;
}

export function useSpeechRecognition({ 
  onResult, 
  onEnd, 
  continuous = false, 
  interimResults = true 
}: UseSpeechRecognitionProps) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const onResultRef = useRef(onResult);
  const onEndRef = useRef(onEnd);

  useEffect(() => {
    onResultRef.current = onResult;
    onEndRef.current = onEnd;
  }, [onResult, onEnd]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    // Setting to a more generic language or handling it dynamically
    // Note: Most browsers support automatic language detection if you don't set it, 
    // or you can set it to a primary one. For better Hindi support, we can use 'en-IN' or 'hi-IN'.
    recognition.lang = 'en-IN'; 

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') {
        // Just ignore no-speech, it happens often
        return;
      }
      console.error("Speech Recognition Error:", event.error);
      if (event.error === 'not-allowed') {
        setError("Microphone access denied. Please check your browser settings.");
      } else if (event.error === 'network') {
        setError("Network error during speech recognition.");
      } else {
        setError(event.error);
      }
      setIsListening(false);
    };

    const processedIndices = new Set<number>();

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i];
        if (result.isFinal) {
          if (!processedIndices.has(i)) {
            finalTranscript += result[0].transcript;
            processedIndices.add(i);
          }
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      
      if (finalTranscript || interimTranscript) {
        onResultRef.current(finalTranscript, interimTranscript);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      processedIndices.clear();
      if (onEndRef.current) onEndRef.current();
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null; // Prevent callback on cleanup
        recognitionRef.current.stop();
      }
    };
  }, [continuous, interimResults]);


  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error("Failed to start recognition:", e);
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  return {
    isListening,
    error,
    startListening,
    stopListening
  };
}
