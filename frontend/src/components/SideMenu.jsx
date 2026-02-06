import { useState } from 'react'
import { Link } from 'react-router-dom'

function SideMenu({ isOpen, onClose }) {
    if (!isOpen) return null

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Side Panel */}
            <div className="fixed inset-y-0 left-0 w-72 bg-surface-dark border-r border-slate-700 z-50 shadow-xl">
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="p-4 border-b border-slate-700">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                                    <span className="material-symbols-outlined text-white text-xl">mic</span>
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white">Audio Transcriber</h2>
                                    <p className="text-xs text-slate-400">Local Processing</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-700 transition-colors text-slate-400 hover:text-white"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 p-4 space-y-1">
                        <Link
                            to="/"
                            onClick={onClose}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-700/50 transition-colors text-slate-200 hover:text-white group"
                        >
                            <span className="material-symbols-outlined text-slate-400 group-hover:text-primary">home</span>
                            <span className="font-medium">Dashboard</span>
                        </Link>
                        <Link
                            to="/settings"
                            onClick={onClose}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-700/50 transition-colors text-slate-200 hover:text-white group"
                        >
                            <span className="material-symbols-outlined text-slate-400 group-hover:text-primary">settings</span>
                            <span className="font-medium">Settings</span>
                        </Link>
                    </nav>

                    {/* Footer */}
                    <div className="p-4 border-t border-slate-700">
                        <div className="text-xs text-slate-500 text-center">
                            <p>Version 1.0.0</p>
                            <p>All processing happens locally</p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

export default SideMenu
