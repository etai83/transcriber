import { useState, useEffect } from 'react'

function AIAssistant({
    suggestions = [],
    isLoading = false,
    error = null,
    onAskSpeaker,
    onMarkForLater,
    onDismiss,
    onDismissSuggestion,
    className = ''
}) {
    const [dismissedIds, setDismissedIds] = useState(new Set())

    // Reset dismissed suggestions when new suggestions come in
    useEffect(() => {
        if (suggestions.length > 0) {
            setDismissedIds(new Set())
        }
    }, [suggestions])

    const handleDismiss = (index) => {
        setDismissedIds(prev => new Set([...prev, index]))
        if (onDismissSuggestion) onDismissSuggestion(index)
    }

    const handleDismissAll = () => {
        if (onDismiss) onDismiss()
    }

    const handleAskSpeaker = (suggestion) => {
        if (onAskSpeaker) onAskSpeaker(suggestion)
    }

    const handleMarkForLater = (suggestion) => {
        if (onMarkForLater) onMarkForLater(suggestion)
    }

    const getTypeIcon = (type) => {
        switch (type) {
            case 'clarification':
                return 'help'
            case 'follow_up':
                return 'chat'
            case 'note':
                return 'sticky_note_2'
            default:
                return 'psychology'
        }
    }

    const getTypeColor = (type) => {
        switch (type) {
            case 'clarification':
                return 'text-amber-500 bg-amber-500/20'
            case 'follow_up':
                return 'text-blue-500 bg-blue-500/20'
            case 'note':
                return 'text-emerald-500 bg-emerald-500/20'
            default:
                return 'text-primary bg-primary/20'
        }
    }

    // Filter out dismissed suggestions
    const visibleSuggestions = suggestions.filter((_, index) => !dismissedIds.has(index))

    // Show loading state
    if (isLoading) {
        return (
            <div className={`bg-gray-900/95 dark:bg-black/90 backdrop-blur-md rounded-xl p-4 shadow-lg border border-white/10 ${className}`}>
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary text-[22px] animate-spin">progress_activity</span>
                    </div>
                    <div className="flex-1">
                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                            AI Analyzing...
                        </span>
                        <p className="text-[13px] text-gray-400 mt-1">Processing latest transcript chunk</p>
                    </div>
                </div>
            </div>
        )
    }

    // Show error state
    if (error) {
        return (
            <div className={`bg-gray-900/95 dark:bg-black/90 backdrop-blur-md rounded-xl p-4 shadow-lg border border-red-500/20 ${className}`}>
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center">
                        <span className="material-symbols-outlined text-red-500 text-[22px]">error</span>
                    </div>
                    <div className="flex-1">
                        <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">
                            AI Assistant Error
                        </span>
                        <p className="text-[13px] text-gray-400 mt-1">{error}</p>
                    </div>
                </div>
            </div>
        )
    }

    // No suggestions
    if (visibleSuggestions.length === 0) {
        return null
    }

    return (
        <div className={`flex flex-col gap-2 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-[14px]">psychology</span>
                    AI Suggestions ({visibleSuggestions.length})
                </span>
                {visibleSuggestions.length > 1 && (
                    <button
                        onClick={handleDismissAll}
                        className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
                    >
                        Dismiss all
                    </button>
                )}
            </div>

            {/* Suggestions */}
            {visibleSuggestions.map((suggestion, index) => {
                const originalIndex = suggestions.indexOf(suggestion)
                return (
                    <div
                        key={originalIndex}
                        className="bg-gray-900/95 dark:bg-black/90 backdrop-blur-md rounded-xl p-3 shadow-lg border border-white/10 animate-slide-up"
                        style={{ animationDelay: `${index * 50}ms` }}
                    >
                        <div className="flex items-start gap-3">
                            {/* Type Icon */}
                            <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${getTypeColor(suggestion.type)}`}>
                                <span className="material-symbols-outlined text-[18px]">{getTypeIcon(suggestion.type)}</span>
                            </div>

                            <div className="flex-1 min-w-0">
                                {/* Header */}
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[11px] font-semibold text-gray-300 truncate">
                                        {suggestion.title}
                                    </span>
                                    <button
                                        onClick={() => handleDismiss(originalIndex)}
                                        className="text-gray-500 hover:text-white transition-colors ml-2"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">close</span>
                                    </button>
                                </div>

                                {/* Message */}
                                <p className="text-[12px] text-gray-400 leading-snug">
                                    {suggestion.message}
                                </p>

                                {/* Action Buttons - only show for clarification type */}
                                {suggestion.type === 'clarification' && (
                                    <div className="flex gap-2 mt-2">
                                        <button
                                            onClick={() => handleAskSpeaker(suggestion)}
                                            className="flex-1 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary text-[10px] font-semibold rounded-lg transition-all"
                                        >
                                            Ask Speaker
                                        </button>
                                        <button
                                            onClick={() => handleMarkForLater(suggestion)}
                                            className="flex-1 py-1.5 bg-gray-700/50 hover:bg-gray-700 text-gray-300 text-[10px] font-semibold rounded-lg transition-all"
                                        >
                                            Mark for Later
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

export default AIAssistant
