const sizeConfig = {
    sm: {
        ring: 'h-12 w-12',
        core: 'h-7 w-7',
        dot: 'h-1.5 w-1.5',
        text: 'text-sm sm:text-base',
    },
    md: {
        ring: 'h-16 w-16',
        core: 'h-10 w-10',
        dot: 'h-2 w-2',
        text: 'text-base sm:text-lg',
    },
    lg: {
        ring: 'h-20 w-20',
        core: 'h-12 w-12',
        dot: 'h-2.5 w-2.5',
        text: 'text-lg sm:text-xl',
    },
}

const Loading = ({
    text = 'Loading...',
    fullScreen = false,
    size = 'lg',
    className = '',
}) => {
    const currentSize = sizeConfig[size] || sizeConfig.lg

    return (
        <div
            role='status'
            aria-live='polite'
            className={`relative flex w-full flex-col items-center justify-center gap-5 overflow-hidden bg-slate-950/70 px-6 py-8 ${
                fullScreen ? 'min-h-screen' : 'min-h-[180px] rounded-2xl'
            } ${className}`}
        >
            <div className='pointer-events-none absolute inset-0 opacity-70'>
                <div className='absolute -left-10 top-4 h-28 w-28 rounded-full bg-cyan-500/15 blur-2xl' />
                <div className='absolute -right-8 bottom-3 h-24 w-24 rounded-full bg-blue-500/20 blur-2xl' />
            </div>

            <div className='relative z-10 flex items-center justify-center'>
                <div className={`${currentSize.ring} rounded-full border border-cyan-300/30`} />
                <div
                    className={`absolute ${currentSize.ring} animate-spin rounded-full border-2 border-transparent border-r-cyan-400 border-t-blue-500`}
                />
                <div
                    className={`absolute ${currentSize.core} rounded-full border border-white/10 bg-slate-900/85 shadow-[0_0_25px_rgba(56,189,248,0.35)]`}
                >
                    <div className='absolute inset-1 rounded-full bg-gradient-to-br from-cyan-300/50 via-blue-400/40 to-cyan-500/40 animate-pulse' />
                </div>

                <span
                    className={`absolute -top-1 ${currentSize.dot} animate-ping rounded-full bg-cyan-300/80`}
                />
                <span
                    className={`absolute -bottom-1 ${currentSize.dot} animate-pulse rounded-full bg-blue-400/80`}
                />
            </div>

            <span className={`z-10 text-center font-medium tracking-wide text-slate-100 ${currentSize.text}`}>
                {text}
            </span>
        </div>
    )
}

export default Loading