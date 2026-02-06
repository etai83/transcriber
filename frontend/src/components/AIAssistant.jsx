function AIAssistant() {
    return (
        <div className="shrink-0 bg-[#161e2c] border-t border-slate-800 px-4 py-4 pb-8 z-20 shadow-[0_-4px_16px_rgba(0,0,0,0.05)] relative">
            {/* Gradient Accent Icon */}
            <div className="absolute -top-3 left-6 bg-gradient-to-r from-secondary to-primary p-1 rounded-lg shadow-lg rotate-3 z-10">
                <span className="material-symbols-outlined text-white text-[16px] block">smart_toy</span>
            </div>

            <div className="flex flex-col gap-3">
                {/* Header */}
                <div className="flex justify-between items-end">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 pl-10">AI Agent Assistant</h3>
                    <span className="text-[10px] text-green-500 font-medium bg-green-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                        Live Analysis
                    </span>
                </div>

                {/* Suggestion Card */}
                <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                    <p className="text-sm text-slate-200 leading-snug">
                        <span className="font-semibold text-primary">Clarification Suggestion:</span> Based on the conversation context, ask about specific details or follow-up questions.
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3 mt-1">
                    <button className="bg-primary hover:bg-blue-600 text-white py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 transition-all">
                        <span className="material-symbols-outlined text-[18px]">record_voice_over</span>
                        Ask Speaker
                    </button>
                    <button className="bg-slate-800 border border-slate-700 text-slate-200 py-3 px-4 rounded-xl font-bold text-sm hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">chat_bubble_outline</span>
                        Follow-up
                    </button>
                </div>
            </div>
        </div>
    )
}

export default AIAssistant
