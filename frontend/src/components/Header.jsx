function Header({
    title,
    showBackButton = false,
    onBackClick,
    onMenuClick,
    rightContent,
    subtitle
}) {
    return (
        <header className="shrink-0 px-5 pt-6 pb-4 flex items-center justify-between z-20">
            {/* Left Button */}
            {showBackButton ? (
                <button
                    onClick={onBackClick}
                    className="size-10 flex items-center justify-center rounded-full hover:bg-slate-700 transition-colors text-slate-300"
                >
                    <span className="material-symbols-outlined">arrow_back_ios_new</span>
                </button>
            ) : (
                <button
                    onClick={onMenuClick}
                    className="size-10 flex items-center justify-center rounded-full bg-surface-dark shadow-sm border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors"
                >
                    <span className="material-symbols-outlined">menu</span>
                </button>
            )}

            {/* Title */}
            <div className="flex flex-col items-center">
                <span className="text-lg font-bold tracking-tight">{title}</span>
                {subtitle && (
                    <p className="text-xs text-slate-400 font-medium">{subtitle}</p>
                )}
            </div>

            {/* Right Content */}
            {rightContent || (
                <button
                    aria-label="Profile"
                    className="size-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center border-2 border-slate-700 shadow-sm"
                >
                    <span className="material-symbols-outlined text-white text-xl">person</span>
                </button>
            )}
        </header>
    )
}

export default Header
