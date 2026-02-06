import { useState } from 'react'
import ConversationRecorder from './ConversationRecorder'
import AudioUploader from './AudioUploader'

function RecordingModal({ onClose, onComplete }) {
    const [mode, setMode] = useState('record') // 'record' or 'upload'

    const handleComplete = () => {
        onComplete?.()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-lg bg-surface-dark rounded-t-3xl border-t border-slate-700 shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-2">
                    <div className="w-12 h-1 bg-slate-600 rounded-full"></div>
                </div>

                {/* Header */}
                <div className="px-6 pb-4 border-b border-slate-700">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-white">New Recording</h2>
                        <button
                            onClick={onClose}
                            className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-700 transition-colors text-slate-400 hover:text-white"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    {/* Mode Tabs */}
                    <div className="flex gap-2 mt-4">
                        <button
                            onClick={() => setMode('record')}
                            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${mode === 'record'
                                    ? 'bg-primary text-white'
                                    : 'bg-slate-800 text-slate-400 hover:text-white'
                                }`}
                        >
                            <span className="material-symbols-outlined text-sm mr-2 align-middle">mic</span>
                            Record
                        </button>
                        <button
                            onClick={() => setMode('upload')}
                            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${mode === 'upload'
                                    ? 'bg-primary text-white'
                                    : 'bg-slate-800 text-slate-400 hover:text-white'
                                }`}
                        >
                            <span className="material-symbols-outlined text-sm mr-2 align-middle">upload</span>
                            Upload
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {mode === 'record' ? (
                        <ConversationRecorder onRecordingComplete={handleComplete} />
                    ) : (
                        <AudioUploader onUploadSuccess={handleComplete} />
                    )}
                </div>
            </div>
        </div>
    )
}

export default RecordingModal
