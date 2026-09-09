import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { showAlert } from '../utils/confirm';

type Props = {
  value: string;
  onChange: (next: string) => void;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function VoiceInputButton({ value, onChange }: Props) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const sessionBaseRef = useRef(value);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
    };
  }, []);

  const stop = () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
    recognitionRef.current = null;
    setListening(false);
  };

  const start = () => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      showAlert(
        'Voice input unavailable',
        Platform.OS === 'web'
          ? 'This browser does not support speech recognition. Try Chrome.'
          : 'Voice input works in the web browser version of the app.',
      );
      return;
    }

    sessionBaseRef.current = value;
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i][0]?.transcript || '';
      }
      const base = sessionBaseRef.current.trim();
      const spoken = transcript.trim();
      onChange(base && spoken ? `${base} ${spoken}` : spoken || base);
    };
    recognition.onerror = () => stop();
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  return (
    <Pressable
      onPress={() => (listening ? stop() : start())}
      style={({ pressed }) => [
        styles.btn,
        listening && styles.btnActive,
        pressed && { opacity: 0.85 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={listening ? 'Stop voice input' : 'Start voice input'}
    >
      <Ionicons name={listening ? 'mic' : 'mic-outline'} size={14} color={listening ? '#fff' : '#495057'} />
      <Text style={[styles.label, listening && styles.labelActive]}>
        {listening ? 'Listening…' : 'Voice Input'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#6c757d',
    backgroundColor: '#f8f9fa',
  },
  btnActive: {
    backgroundColor: colors.brandMagenta,
    borderColor: colors.brandMagenta,
  },
  label: {
    fontSize: 12,
    color: '#495057',
    fontWeight: '600',
  },
  labelActive: {
    color: '#fff',
  },
});
