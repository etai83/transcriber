import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { conversationApi } from '../services/api';
import BottomNav from '../components/BottomNav';

export default function Dashboard() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Poll for updates
  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchConversations = async () => {
    try {
      const data = await conversationApi.list();
      setConversations(data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleTranscribe = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    try {
      const conversation = await conversationApi.create({
        title: selectedFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
        language: 'auto',
        trim_silence: false,
        chunk_interval_sec: 0,
        num_speakers: 2 // Default or from settings
      });

      await conversationApi.addChunk(conversation.id, selectedFile, 0);
      await conversationApi.complete(conversation.id);

      setSelectedFile(null);
      setIsUploading(false);
      fetchConversations();
    } catch (err) {
      console.error(err);
      alert('Upload failed');
      setIsUploading(false);
    }
  };

  const formatDate = (dateString) => {
    const d = new Date(dateString);
    // Simple format: Oct 24 • 10:30 AM
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' • ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formatDuration = (s) => {
    if (!s) return '--:--';
    const m = Math.floor(s / 60);
    const sc = Math.floor(s % 60);
    return `${m}:${sc.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen flex justify-center overflow-x-hidden font-display text-slate-900 dark:text-white">
      <div className="w-full max-w-md bg-background-light dark:bg-background-dark min-h-screen flex flex-col relative shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="h-12 w-full bg-background-light dark:bg-background-dark shrink-0"></div>
        <header className="flex items-center justify-between px-4 py-3 bg-background-light dark:bg-background-dark z-20 sticky top-0">
          <Link to="/settings" className="text-gray-900 dark:text-white p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
            <span className="material-symbols-outlined text-[28px]">menu</span>
          </Link>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Dashboard</h1>
          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-surface-dark overflow-hidden border border-gray-300 dark:border-gray-700">
             <div className="w-full h-full bg-primary flex items-center justify-center text-white text-xs">Me</div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-24 px-4">
          {/* Action Buttons */}
          <div className="mt-4 mb-4 flex gap-4">
            <Link to="/record" className="flex-1 group relative overflow-hidden rounded-2xl bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-700 h-16 shadow-sm active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2">
              <div className="absolute inset-0 bg-gray-100 dark:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <span className="material-symbols-outlined text-gray-900 dark:text-white text-[24px]">mic</span>
              <span className="text-gray-900 dark:text-white text-lg font-bold tracking-wide">Record</span>
            </Link>
            <button onClick={() => fileInputRef.current?.click()} className="flex-1 group relative overflow-hidden rounded-2xl bg-primary h-16 shadow-lg shadow-primary/30 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2">
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <span className="material-symbols-outlined text-white text-[24px]">upload_file</span>
              <span className="text-white text-lg font-bold tracking-wide">Upload</span>
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="audio/*" />
            </button>
          </div>

          {/* Selected File Card */}
          {selectedFile && (
            <div className="mb-6 space-y-3">
              <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-3 border border-gray-200 dark:border-gray-700 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary text-[24px]">audio_file</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{selectedFile.name}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{(selectedFile.size / (1024*1024)).toFixed(1)} MB</span>
                  </div>
                </div>
                <button onClick={() => setSelectedFile(null)} className="p-2 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0">
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
              <button onClick={handleTranscribe} disabled={isUploading} className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-primary/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                {isUploading ? (
                    <>
                    <span className="material-symbols-outlined text-[24px] animate-spin">refresh</span>
                    <span className="text-lg tracking-wide">Uploading...</span>
                    </>
                ) : (
                    <>
                    <span className="material-symbols-outlined text-[24px]">auto_awesome</span>
                    <span className="text-lg tracking-wide">Transcribe</span>
                    </>
                )}
              </button>
            </div>
          )}

          {/* Search */}
          <div className="mb-8">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-gray-500 dark:text-gray-400">search</span>
              </div>
              <input className="block w-full pl-10 pr-3 py-3.5 border-none rounded-xl bg-surface-light dark:bg-surface-dark text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary shadow-sm text-base transition-all" placeholder="Search transcriptions..." type="text"/>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-gray-900 dark:text-white text-lg font-bold tracking-tight">Recent Activity</h2>
              <button className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">View All</button>
            </div>

            {loading ? (
                <div className="text-center text-gray-500 py-8">Loading...</div>
            ) : conversations.length === 0 ? (
                <div className="text-center text-gray-500 py-8">No recordings yet</div>
            ) : (
                conversations.map(conv => (
                    <div key={conv.id} onClick={() => navigate(`/conversation/${conv.id}`)} className="group bg-surface-light dark:bg-surface-dark rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 hover:border-primary/30 dark:hover:border-primary/50 transition-all cursor-pointer">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1 line-clamp-1 group-hover:text-primary transition-colors">{conv.title}</h3>
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 font-medium">
                            <span>{formatDate(conv.created_at)}</span>
                          </div>
                        </div>
                        <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                          <span className="material-symbols-outlined text-[20px]">more_vert</span>
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        {conv.status === 'processing' || conv.status === 'pending' || conv.status === 'recording' ? (
                             <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20">
                                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                                <span className="text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider">{conv.status}</span>
                             </div>
                        ) : conv.status === 'failed' ? (
                             <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20">
                                <span className="material-symbols-outlined text-red-600 dark:text-red-500 text-[14px]">error</span>
                                <span className="text-xs font-bold text-red-600 dark:text-red-500 uppercase tracking-wider">Failed</span>
                             </div>
                        ) : (
                             <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                                <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-500 text-[14px]">check_circle</span>
                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider">Completed</span>
                             </div>
                        )}
                        <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{formatDuration(conv.total_duration_sec)}</span>
                      </div>
                    </div>
                ))
            )}
          </div>
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
