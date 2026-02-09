import { useState } from 'react'

function AIAssistant({ suggestion = null, onAskSpeaker, onMarkForLater, onDismiss, className = '' }) {
    const [isVisible, setIsVisible] = useState(true)

    // Default suggestion for demo
    const defaultSuggestion = {
        type: 'ambiguity',
        title: 'Ambiguity Detected',
        message: "Shara mentioned server resources. It's unclear if she refers to the staging or production cluster.",
    }

    const currentSuggestion = suggestion || defaultSuggestion

    const handleDismiss = () => {
        setIsVisible(false)
        if (onDismiss) onDismiss()
    }

    const handleAskSpeaker = () => {
        if (onAskSpeaker) onAskSpeaker(currentSuggestion)
    }

    const handleMarkForLater = () => {
        if (onMarkForLater) onMarkForLater(currentSuggestion)
    }

    if (!isVisible) return null

    return (
        <div className={`bg-gray-900/95 dark:bg-black/90 backdrop-blur-md rounded-xl p-4 shadow-lg border border-white/10 ${className}`}>
            <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="mt-0.5 w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary text-[22px]">psychology</span>
                </div>

                <div className="flex-1">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                            {currentSuggestion.title}
                        </span>
                        <button
                            onClick={handleDismiss}
                            className="text-gray-400 hover:text-white transition-colors"
                        >
                            <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                    </div>

                    {/* Message */}
                    <p className="text-[13px] text-gray-200 font-medium leading-snug">
                        {currentSuggestion.message}
                    </p>

                    {/* Action Buttons */}
                    <div className="flex gap-2 mt-4">
                        <button
                            onClick={handleAskSpeaker}
                            className="flex-1 py-2 bg-primary hover:bg-primary/90 text-white text-[11px] font-bold rounded-lg shadow-sm shadow-primary/30 active:scale-[0.98] transition-all"
                        >
                            Ask Speaker
                        </button>
                        <button
                            onClick={handleMarkForLater}
                            className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 text-[11px] font-bold rounded-lg active:scale-[0.98] transition-all"
                        >
                            Mark for Later
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default AIAssistant
