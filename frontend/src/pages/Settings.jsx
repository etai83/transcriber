import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import ToggleSwitch from '../components/ToggleSwitch'

function Settings() {
    const navigate = useNavigate()

    // Settings state
    const [noiseReduction, setNoiseReduction] = useState(true)
    const [silenceRemoval, setSilenceRemoval] = useState(false)
    const [identifySpeakers, setIdentifySpeakers] = useState(true)
    const [autoDelete, setAutoDelete] = useState(false)

    return (
        <>
            <Header
                title="Settings"
                showBackButton={true}
                onBackClick={() => navigate('/')}
                rightContent={<div className="size-10"></div>}
            />

            <main className="flex-1 overflow-y-auto p-4 space-y-8 pb-10 scroll-smooth">
                {/* Transcription Engine */}
                <section>
                    <h2 className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Transcription Engine
                    </h2>
                    <div className="bg-surface-dark rounded-xl border border-slate-700/50 overflow-hidden shadow-sm">
                        <button className="w-full flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors group text-left">
                            <div className="flex items-center gap-4">
                                <div className="size-8 rounded-lg bg-blue-900/40 text-blue-400 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-[20px]">psychology</span>
                                </div>
                                <div>
                                    <p className="font-medium text-sm text-white">Whisper Model</p>
                                    <p className="text-xs text-slate-400">Large v3 (Multilingual)</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-slate-400 text-xl group-hover:text-slate-300 transition-colors">chevron_right</span>
                            </div>
                        </button>
                    </div>
                    <p className="px-4 mt-2 text-xs text-slate-500 leading-relaxed">
                        Larger models provide better accuracy but require more processing power.
                    </p>
                </section>

                {/* Audio Settings */}
                <section>
                    <h2 className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Audio Settings
                    </h2>
                    <div className="bg-surface-dark rounded-xl border border-slate-700/50 overflow-hidden shadow-sm divide-y divide-slate-700/50">
                        <div className="flex items-center justify-between p-4">
                            <div className="flex items-center gap-4">
                                <div className="size-8 rounded-lg bg-purple-900/40 text-purple-400 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-[20px]">graphic_eq</span>
                                </div>
                                <span className="font-medium text-sm text-white">Noise Reduction</span>
                            </div>
                            <ToggleSwitch checked={noiseReduction} onChange={setNoiseReduction} />
                        </div>
                        <div className="flex items-center justify-between p-4">
                            <div className="flex items-center gap-4">
                                <div className="size-8 rounded-lg bg-purple-900/40 text-purple-400 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-[20px]">content_cut</span>
                                </div>
                                <span className="font-medium text-sm text-white">Silence Removal</span>
                            </div>
                            <ToggleSwitch checked={silenceRemoval} onChange={setSilenceRemoval} />
                        </div>
                        <div className="flex items-center justify-between p-4">
                            <div className="flex items-center gap-4">
                                <div className="size-8 rounded-lg bg-purple-900/40 text-purple-400 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-[20px]">groups</span>
                                </div>
                                <span className="font-medium text-sm text-white">Identify Speakers</span>
                            </div>
                            <ToggleSwitch checked={identifySpeakers} onChange={setIdentifySpeakers} />
                        </div>
                    </div>
                </section>

                {/* Language */}
                <section>
                    <h2 className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Language
                    </h2>
                    <div className="bg-surface-dark rounded-xl border border-slate-700/50 overflow-hidden shadow-sm divide-y divide-slate-700/50">
                        <button className="w-full flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors group text-left">
                            <div className="flex items-center gap-4">
                                <div className="size-8 rounded-lg bg-emerald-900/40 text-emerald-400 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-[20px]">translate</span>
                                </div>
                                <span className="font-medium text-sm text-white">Transcription Language</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-400">English</span>
                                <span className="material-symbols-outlined text-slate-400 text-xl group-hover:text-slate-300 transition-colors">chevron_right</span>
                            </div>
                        </button>
                        <button className="w-full flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors group text-left">
                            <div className="flex items-center gap-4">
                                <div className="size-8 rounded-lg bg-emerald-900/40 text-emerald-400 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-[20px]">language</span>
                                </div>
                                <span className="font-medium text-sm text-white">App Interface</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-400">English</span>
                                <span className="material-symbols-outlined text-slate-400 text-xl group-hover:text-slate-300 transition-colors">chevron_right</span>
                            </div>
                        </button>
                    </div>
                </section>

                {/* Storage */}
                <section>
                    <h2 className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Storage
                    </h2>
                    <div className="bg-surface-dark rounded-xl border border-slate-700/50 overflow-hidden shadow-sm divide-y divide-slate-700/50">
                        <button className="w-full flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors group text-left">
                            <div className="flex items-center gap-4">
                                <div className="size-8 rounded-lg bg-orange-900/40 text-orange-400 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-[20px]">folder_open</span>
                                </div>
                                <span className="font-medium text-sm text-white">Manage Local Files</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-400">1.2 GB</span>
                                <span className="material-symbols-outlined text-slate-400 text-xl group-hover:text-slate-300 transition-colors">chevron_right</span>
                            </div>
                        </button>
                        <div className="flex items-center justify-between p-4">
                            <div className="flex items-center gap-4">
                                <div className="size-8 rounded-lg bg-orange-900/40 text-orange-400 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-[20px]">auto_delete</span>
                                </div>
                                <span className="font-medium text-sm text-white">Auto-delete after 30 days</span>
                            </div>
                            <ToggleSwitch checked={autoDelete} onChange={setAutoDelete} />
                        </div>
                    </div>
                </section>

                {/* About */}
                <section>
                    <h2 className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        About
                    </h2>
                    <div className="bg-surface-dark rounded-xl border border-slate-700/50 overflow-hidden shadow-sm divide-y divide-slate-700/50">
                        <button className="w-full flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors group text-left">
                            <span className="font-medium text-sm text-white pl-1">Terms of Service</span>
                            <span className="material-symbols-outlined text-slate-400 text-xl group-hover:text-slate-300 transition-colors">chevron_right</span>
                        </button>
                        <button className="w-full flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors group text-left">
                            <span className="font-medium text-sm text-white pl-1">Privacy Policy</span>
                            <span className="material-symbols-outlined text-slate-400 text-xl group-hover:text-slate-300 transition-colors">chevron_right</span>
                        </button>
                        <div className="flex items-center justify-between p-4">
                            <span className="font-medium text-sm text-white pl-1">Version</span>
                            <span className="text-sm text-slate-400">1.0.0</span>
                        </div>
                    </div>
                </section>

                {/* Reset Button */}
                <div className="pt-4 pb-8">
                    <button className="w-full py-3 rounded-xl bg-red-900/10 text-red-400 font-medium text-sm border border-red-900/20 hover:bg-red-900/20 transition-colors">
                        Reset All Settings
                    </button>
                </div>
            </main>

            {/* Gradient overlay */}
            <div className="fixed top-0 left-0 w-full h-40 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none z-0"></div>
        </>
    )
}

export default Settings
