import { useRef, useState, useEffect } from 'react'

function AudioPlayerNew({ audioUrl, onTimeUpdate, currentSegmentTime }) {
    const audioRef = useRef(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)

    useEffect(() => {
        const audio = audioRef.current
        if (!audio) return

        const handleTimeUpdate = () => {
            setCurrentTime(audio.currentTime)
            onTimeUpdate?.(audio.currentTime)
        }
        const handleLoadedMetadata = () => setDuration(audio.duration)
        const handleEnded = () => setIsPlaying(false)

        audio.addEventListener('timeupdate', handleTimeUpdate)
        audio.addEventListener('loadedmetadata', handleLoadedMetadata)
        audio.addEventListener('ended', handleEnded)

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate)
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
            audio.removeEventListener('ended', handleEnded)
        }
    }, [onTimeUpdate])

    const togglePlay = () => {
        if (isPlaying) {
            audioRef.current?.pause()
        } else {
            audioRef.current?.play()
        }
        setIsPlaying(!isPlaying)
    }

    const handleSeek = (e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - rect.left
        const percentage = x / rect.width
        const newTime = percentage * duration
        if (audioRef.current) {
            audioRef.current.currentTime = newTime
        }
    }

    const seekTo = (time) => {
        if (audioRef.current) {
            audioRef.current.currentTime = time
            if (!isPlaying) {
                audioRef.current.play()
                setIsPlaying(true)
            }
        }
    }

    // Expose seekTo via ref passed from parent if needed
    useEffect(() => {
        if (currentSegmentTime !== undefined && currentSegmentTime !== null) {
            seekTo(currentSegmentTime)
        }
    }, [currentSegmentTime])

    const formatTime = (seconds) => {
        if (isNaN(seconds)) return '0:00'
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0

    // Generate waveform bars (decorative)
    const waveformBars = [4, 8, 6, 10, 14, 8, 12, 6, 4, 10, 16, 12, 6, 10, 5, 8, 12, 4, 8, 14, 6, 4, 10, 4, 10, 6, 3, 8, 14, 6, 4, 10, 5, 8, 12, 4, 10, 6, 3]

    return (
        <div className="shrink-0 bg-[#161e2c] border-b border-slate-800 p-4 pb-6 z-10 shadow-sm">
            <audio ref={audioRef} src={audioUrl} preload="metadata" />

            {/* Waveform Visualization */}
            <div
                className="h-16 flex items-center justify-center gap-[2px] mb-4 w-full overflow-hidden px-2 opacity-90 cursor-pointer"
                onClick={handleSeek}
            >
                {waveformBars.map((height, index) => {
                    const barPosition = (index / waveformBars.length) * 100
                    const isPlayed = barPosition <= progressPercentage
                    return (
                        <div
                            key={index}
                            className={`w-1 rounded-full transition-colors ${isPlayed ? 'bg-primary' : 'bg-slate-600'
                                }`}
                            style={{ height: `${height * 4}px` }}
                        />
                    )
                })}
            </div>

            {/* Time Display and Controls */}
            <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs font-semibold text-slate-400 tracking-wide px-1">
                    <span className="text-primary">{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>

                <div className="flex items-center justify-between mt-1">
                    {/* Playback speed (placeholder) */}
                    <button className="text-xs font-bold text-slate-400 bg-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-700 transition">
                        1.0x
                    </button>

                    {/* Main Controls */}
                    <div className="flex items-center gap-6">
                        {/* Play/Pause */}
                        <button
                            onClick={togglePlay}
                            className="bg-primary hover:bg-blue-600 text-white rounded-full p-4 shadow-lg shadow-blue-500/30 transition transform active:scale-95 flex items-center justify-center"
                        >
                            <span className="material-symbols-outlined text-[32px] font-variation-fill">
                                {isPlaying ? 'pause' : 'play_arrow'}
                            </span>
                        </button>
                    </div>

                    {/* Settings */}
                    <button className="text-slate-400 hover:text-white transition">
                        <span className="material-symbols-outlined">tune</span>
                    </button>
                </div>
            </div>
        </div>
    )
}

export default AudioPlayerNew
