export interface Transcription {
  id: number;
  filename: string;
  audio_path: string;
  transcript_path: string | null;
  language: string;
  detected_language?: string;
  trim_silence: boolean;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  duration_sec?: number;
  transcript_text?: string;
  created_at: string;
  completed_at?: string;
  error_message?: string;
}

export interface Conversation {
  id: number;
  title: string;
  description?: string;
  status: 'recording' | 'processing' | 'completed' | 'failed';
  total_duration_sec?: number;
  created_at: string;
  chunks?: Transcription[];
}
