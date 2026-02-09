import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function Settings() {
    const navigate = useNavigate()

    // Settings state
    const [whisperModel, setWhisperModel] = useState('large-v3')
    const [computeType, setComputeType] = useState('int8')
    const [speakerDiarization, setSpeakerDiarization] = useState(true)
    const [inputDevice, setInputDevice] = useState('Built-in Microphone')
    const [autoNormalization, setAutoNormalization] = useState(false)
    const [appLanguage, setAppLanguage] = useState('English')
    const [defaultTranslation, setDefaultTranslation] = useState('Hebrew')
    const [storageUsed, setStorageUsed] = useState('1.2 GB')

    // Load settings from backend (placeholder)
    useEffect(() => {
        // TODO: Fetch actual settings from backend
    }, [])

    const handleExportData = () => {
        alert('Export functionality coming soon!')
    }

    const handleClearCache = () => {
        if (confirm('Are you sure you want to clear the cache? This action cannot be undone.')) {
            alert('Cache cleared!')
        }
    }

    return (
        <>
            {/* Header */}
            <header className="sticky top-0 z-50 flex items-center justify-between bg-background-dark/95 backdrop-blur-md px-4 py-3 border-b border-slate-800">
                <button
                    onClick={() => navigate('/')}
                    className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-800 transition-colors text-white"
                >
                    <span className="material-symbols-outlined text-[28px]">menu</span>
                </button>
                <h1 className="text-white text-lg font-bold tracking-tight">Settings</h1>
                <div className="flex items-center justify-end w-10">
                    <button className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-800 transition-colors text-slate-400 hover:text-white">
                        <span className="material-symbols-outlined text-[24px]">search</span>
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex flex-col gap-6 p-4 pb-12 overflow-y-auto">
                {/* Transcription Section */}
                <section>
                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 ml-2">Transcription</h3>
                    <div className="flex flex-col rounded-xl overflow-hidden bg-surface-dark divide-y divide-slate-800 border border-slate-800">
                        {/* Whisper Model */}
                        <button className="flex items-center justify-between p-4 hover:bg-surface-highlight transition-colors w-full group">
                            <div className="flex items-center gap-3 text-left">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-500">
                                    <span className="material-symbols-outlined text-[20px]">psychology</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-white text-sm font-medium">Whisper Model</span>
                                    <span className="text-slate-500 text-xs">Accuracy vs Speed</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-slate-400 text-sm">{whisperModel}</span>
                                <span className="material-symbols-outlined text-slate-500 text-[20px]">chevron_right</span>
                            </div>
                        </button>

                        {/* Compute Type */}
                        <button className="flex items-center justify-between p-4 hover:bg-surface-highlight transition-colors w-full">
                            <div className="flex items-center gap-3 text-left">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-500">
                                    <span className="material-symbols-outlined text-[20px]">memory</span>
                                </div>
                                <span className="text-white text-sm font-medium">Compute Type</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-slate-400 text-sm">{computeType}</span>
                                <span className="material-symbols-outlined text-slate-500 text-[20px]">chevron_right</span>
                            </div>
                        </button>

                        {/* Speaker Diarization Toggle */}
                        <div className="flex items-center justify-between p-4 bg-surface-dark">
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-500">
                                    <span className="material-symbols-outlined text-[20px]">record_voice_over</span>
                                </div>
                                <span className="text-white text-sm font-medium">Speaker Diarization</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={speakerDiarization}
                                    onChange={(e) => setSpeakerDiarization(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                            </label>
                        </div>
                    </div>
                </section>

                {/* AI Assistant Section */}
                <section>
                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 ml-2">AI Assistant</h3>
                    <div className="flex flex-col rounded-xl overflow-hidden bg-surface-dark divide-y divide-slate-800 border border-slate-800">
                        {/* AI Assistant Toggle */}
                        <div className="flex items-center justify-between p-4 bg-surface-dark">
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/20 text-violet-500">
                                    <span className="material-symbols-outlined text-[20px]">psychology</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-white text-sm font-medium">Live Recommendations</span>
                                    <span className="text-slate-500 text-xs">AI suggestions during recording</span>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={true}
                                    onChange={() => { }}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                            </label>
                        </div>

                        {/* AI Model Selection */}
                        <button className="flex items-center justify-between p-4 hover:bg-surface-highlight transition-colors w-full group">
                            <div className="flex items-center gap-3 text-left">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/20 text-violet-500">
                                    <span className="material-symbols-outlined text-[20px]">smart_toy</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-white text-sm font-medium">AI Model</span>
                                    <span className="text-slate-500 text-xs">Select model for recommendations</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-slate-400 text-sm">gemini-2.0-flash</span>
                                <span className="material-symbols-outlined text-slate-500 text-[20px]">chevron_right</span>
                            </div>
                        </button>
                    </div>
                </section>

                {/* Audio Section */}
                <section>
                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 ml-2">Audio</h3>
                    <div className="flex flex-col rounded-xl overflow-hidden bg-surface-dark divide-y divide-slate-800 border border-slate-800">
                        {/* Input Device */}
                        <button className="flex items-center justify-between p-4 hover:bg-surface-highlight transition-colors w-full">
                            <div className="flex items-center gap-3 text-left">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-500">
                                    <span className="material-symbols-outlined text-[20px]">mic</span>
                                </div>
                                <span className="text-white text-sm font-medium">Input Device</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-slate-400 text-sm max-w-[120px] truncate">{inputDevice}</span>
                                <span className="material-symbols-outlined text-slate-500 text-[20px]">chevron_right</span>
                            </div>
                        </button>

                        {/* Auto-normalization Toggle */}
                        <div className="flex items-center justify-between p-4 bg-surface-dark">
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-500">
                                    <span className="material-symbols-outlined text-[20px]">equalizer</span>
                                </div>
                                <span className="text-white text-sm font-medium">Auto-normalization</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={autoNormalization}
                                    onChange={(e) => setAutoNormalization(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                            </label>
                        </div>
                    </div>
                </section>

                {/* Language Section */}
                <section>
                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 ml-2">Language</h3>
                    <div className="flex flex-col rounded-xl overflow-hidden bg-surface-dark divide-y divide-slate-800 border border-slate-800">
                        {/* App Language */}
                        <button className="flex items-center justify-between p-4 hover:bg-surface-highlight transition-colors w-full">
                            <div className="flex items-center gap-3 text-left">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-500">
                                    <span className="material-symbols-outlined text-[20px]">language</span>
                                </div>
                                <span className="text-white text-sm font-medium">App Language</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-slate-400 text-sm">{appLanguage}</span>
                                <span className="material-symbols-outlined text-slate-500 text-[20px]">chevron_right</span>
                            </div>
                        </button>

                        {/* Default Translation */}
                        <button className="flex items-center justify-between p-4 hover:bg-surface-highlight transition-colors w-full">
                            <div className="flex items-center gap-3 text-left">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-500">
                                    <span className="material-symbols-outlined text-[20px]">translate</span>
                                </div>
                                <span className="text-white text-sm font-medium">Default Translation</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-slate-400 text-sm">{defaultTranslation}</span>
                                <span className="material-symbols-outlined text-slate-500 text-[20px]">chevron_right</span>
                            </div>
                        </button>
                    </div>
                </section>

                {/* Local Storage Section */}
                <section>
                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 ml-2">Local Storage</h3>
                    <div className="flex flex-col rounded-xl overflow-hidden bg-surface-dark divide-y divide-slate-800 border border-slate-800">
                        {/* Storage Used */}
                        <div className="flex items-center justify-between p-4 bg-surface-dark">
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/20 text-orange-500">
                                    <span className="material-symbols-outlined text-[20px]">hard_drive</span>
                                </div>
                                <span className="text-white text-sm font-medium">Storage Used</span>
                            </div>
                            <span className="text-slate-400 text-sm">{storageUsed}</span>
                        </div>

                        {/* Export All */}
                        <button
                            onClick={handleExportData}
                            className="flex items-center justify-center p-4 hover:bg-surface-highlight transition-colors w-full"
                        >
                            <span className="text-primary text-sm font-semibold">Export All Data</span>
                        </button>

                        {/* Clear Cache */}
                        <button
                            onClick={handleClearCache}
                            className="flex items-center justify-center p-4 hover:bg-surface-highlight transition-colors w-full border-t border-slate-800"
                        >
                            <span className="text-red-500 text-sm font-semibold">Clear Cache</span>
                        </button>
                    </div>
                </section>

                {/* Footer */}
                <div className="text-center mt-4">
                    <p className="text-slate-600 text-xs">Version 1.1.0 (Build 250)</p>
                </div>
            </main>
        </>
    )
}

export default Settings
