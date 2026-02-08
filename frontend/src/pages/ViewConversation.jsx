import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { conversationApi, transcriptionApi } from '../services/api'

export default function ViewConversation() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [conversation, setConversation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentChunkIdx, setCurrentChunkIdx] = useState(0)
  const [currentTime, setCurrentTime] = useState(0) // In seconds, relative to chunk
  const [totalTime, setTotalTime] = useState(0) // Total duration of conversation
  const audioRef = useRef(null)

  useEffect(() => {
    fetchConversation()
  }, [id])

  const fetchConversation = async () => {
    try {
      const data = await conversationApi.get(id)
      setConversation(data)
      setTotalTime(data.total_duration_sec || 0)
      setLoading(false)
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }

  const getSortedChunks = () => {
      return conversation?.chunks?.sort((a, b) => (a.chunk_index ?? 0) - (b.chunk_index ?? 0)) || [];
  }

  const chunks = getSortedChunks();

  // Playback logic
  useEffect(() => {
      if (isPlaying && audioRef.current) {
          audioRef.current.play().catch(e => console.error(e));
      } else if (!isPlaying && audioRef.current) {
          audioRef.current.pause();
      }
  }, [isPlaying]);

  useEffect(() => {
      if (chunks.length > 0 && currentChunkIdx < chunks.length) {
          const chunkId = chunks[currentChunkIdx].id;
          if (audioRef.current) {
              const wasPlaying = isPlaying;
              audioRef.current.src = transcriptionApi.getAudioUrl(chunkId);
              if (wasPlaying) audioRef.current.play();
          }
      }
  }, [currentChunkIdx, conversation]); // Reload audio when chunk changes

  const handleAudioEnded = () => {
      if (currentChunkIdx < chunks.length - 1) {
          setCurrentChunkIdx(prev => prev + 1);
      } else {
          setIsPlaying(false);
          setCurrentChunkIdx(0);
      }
  };

  const handleTimeUpdate = () => {
      if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };

  const togglePlay = () => setIsPlaying(!isPlaying);

  // Parse segments
  const getAllSegments = () => {
      let segments = [];
      let timeOffset = 0;
      chunks.forEach(chunk => {
          if (chunk.transcript_segments) {
              try {
                  const data = typeof chunk.transcript_segments === 'string' ? JSON.parse(chunk.transcript_segments) : chunk.transcript_segments;
                  if (data.segments) {
                      segments.push(...data.segments.map(s => ({
                          ...s,
                          start: s.start + timeOffset,
                          end: s.end + timeOffset,
                          chunkIndex: chunk.chunk_index
                      })));
                  } else {
                       // Fallback to full text if no segments
                       segments.push({
                           text: chunk.transcript_text,
                           speaker: 'UNKNOWN',
                           start: timeOffset,
                           end: timeOffset + (chunk.duration_sec || 0),
                           chunkIndex: chunk.chunk_index
                       });
                  }
              } catch (e) {
                  segments.push({
                       text: chunk.transcript_text,
                       speaker: 'UNKNOWN',
                       start: timeOffset,
                       end: timeOffset + (chunk.duration_sec || 0),
                       chunkIndex: chunk.chunk_index
                  });
              }
          } else if (chunk.transcript_text) {
              segments.push({
                   text: chunk.transcript_text,
                   speaker: 'UNKNOWN',
                   start: timeOffset,
                   end: timeOffset + (chunk.duration_sec || 0),
                   chunkIndex: chunk.chunk_index
               });
          }
          timeOffset += (chunk.duration_sec || 0);
      });
      return segments;
  };

  const segments = getAllSegments();

  const formatTime = (s) => {
      if (!s) return '00:00';
      const m = Math.floor(s / 60);
      const sc = Math.floor(s % 60);
      return `${m.toString().padStart(2, '0')}:${sc.toString().padStart(2, '0')}`;
  };

  // Helper to get total current time (sum of previous chunks + current chunk time)
  const getCurrentTotalTime = () => {
      let t = 0;
      for (let i = 0; i < currentChunkIdx; i++) {
          t += chunks[i].duration_sec || 0;
      }
      return t + currentTime;
  };

  if (loading) return <div className="text-center py-10">Loading...</div>;
  if (!conversation) return <div className="text-center py-10">Conversation not found</div>;

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display antialiased h-screen w-full flex flex-col overflow-hidden">
      <audio ref={audioRef} onEnded={handleAudioEnded} onTimeUpdate={handleTimeUpdate} className="hidden" />
      
      {/* Top App Bar */}
      <header className="shrink-0 bg-surface-light dark:bg-[#111822] border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between z-20">
        <Link to="/" className="size-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300">
          <span className="material-symbols-outlined">arrow_back_ios_new</span>
        </Link>
        <div className="flex-1 px-4 text-center">
          <h1 className="text-base font-bold truncate">{conversation.title}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {new Date(conversation.created_at).toLocaleDateString()} • {formatTime(totalTime)}
          </p>
        </div>
        <button className="size-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300">
          <span className="material-symbols-outlined">more_horiz</span>
        </button>
      </header>

      {/* Sticky Audio Player */}
      <div className="shrink-0 bg-surface-light dark:bg-[#161e2c] border-b border-slate-200 dark:border-slate-800 p-4 pb-6 z-10 shadow-sm">
        {/* Waveform Visualization (Simulated) */}
        <div className="h-16 flex items-center justify-center gap-[2px] mb-4 w-full overflow-hidden px-2 opacity-90">
            {Array.from({ length: 40 }).map((_, i) => (
                <div key={i} className={`w-1 rounded-full h-${Math.floor(Math.random() * 12) + 4} ${i / 40 < getCurrentTotalTime() / totalTime ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
            ))}
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wide px-1">
                <span className="text-primary">{formatTime(getCurrentTotalTime())}</span>
                <span>{formatTime(totalTime)}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
                <button className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition">1.0x</button>
                <div className="flex items-center gap-6">
                    <button className="text-slate-800 dark:text-white hover:text-primary transition" onClick={() => { if(audioRef.current) audioRef.current.currentTime -= 10; }}>
                        <span className="material-symbols-outlined text-[32px]">replay_10</span>
                    </button>
                    <button onClick={togglePlay} className="bg-primary hover:bg-blue-600 text-white rounded-full p-4 shadow-lg shadow-blue-500/30 transition transform active:scale-95 flex items-center justify-center">
                        <span className="material-symbols-outlined text-[32px] font-variation-fill">{isPlaying ? 'pause' : 'play_arrow'}</span>
                    </button>
                    <button className="text-slate-800 dark:text-white hover:text-primary transition" onClick={() => { if(audioRef.current) audioRef.current.currentTime += 10; }}>
                        <span className="material-symbols-outlined text-[32px]">forward_10</span>
                    </button>
                </div>
                <button className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition">
                    <span className="material-symbols-outlined">tune</span>
                </button>
            </div>
        </div>
      </div>

      {/* Transcript List */}
      <main className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth pb-24">
        {segments.map((seg, i) => (
            <div key={i} className={`group flex gap-4 transition-colors p-2 -mx-2 rounded-xl border border-transparent ${
                getCurrentTotalTime() >= seg.start && getCurrentTotalTime() <= seg.end
                ? 'bg-primary/5 dark:bg-primary/10 border-primary/20'
                : 'hover:bg-slate-100 dark:hover:bg-white/5 hover:border-slate-200 dark:hover:border-slate-700/50'
            }`}>
                <div className="shrink-0 pt-1">
                    <div className={`size-10 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 shadow-sm ${
                        seg.speaker === 'SPEAKER_00' ? 'bg-blue-500 border-blue-600' :
                        seg.speaker === 'SPEAKER_01' ? 'bg-purple-500 border-purple-600' :
                        'bg-gray-500 border-gray-600'
                    }`}>
                        {seg.speaker?.substring(0,2) || 'UK'}
                    </div>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                             seg.speaker === 'SPEAKER_00' ? 'text-blue-600 bg-blue-100' :
                             seg.speaker === 'SPEAKER_01' ? 'text-purple-600 bg-purple-100' :
                             'text-gray-600 bg-gray-100'
                        }`}>{seg.speaker || 'Unknown'}</span>
                        <span className="text-xs text-slate-400 font-mono">{formatTime(seg.start)}</span>
                    </div>
                    <div className="relative">
                        <p className="text-[17px] leading-relaxed text-slate-700 dark:text-slate-200 outline-none p-1 rounded -ml-1 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-primary/50 transition-all" contentEditable={true} suppressContentEditableWarning={true}>
                            {seg.text}
                        </p>
                    </div>
                </div>
            </div>
        ))}
      </main>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-30">
        <button className="bg-primary hover:bg-blue-600 text-white shadow-xl shadow-blue-600/30 rounded-2xl p-4 flex items-center gap-2 transition-transform hover:scale-105 active:scale-95">
          <span className="material-symbols-outlined">ios_share</span>
          <span className="font-bold pr-1">Export</span>
        </button>
      </div>

      {/* Background Gradient Effect */}
      <div className="fixed top-0 left-0 w-full h-40 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none z-0"></div>
    </div>
  )
}
