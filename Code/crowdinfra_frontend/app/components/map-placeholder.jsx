import Loading from './loading'

export default function MapPlaceholder({
  title = 'Loading map',
  message = 'The rest of the page is ready while Google Maps finishes loading.',
  loading = true,
  minHeightClass = 'min-h-[320px]',
}) {
  return (
    <div
      className={`flex w-full flex-col items-center justify-center rounded-2xl border border-white/10 bg-slate-950/70 px-6 py-8 text-center text-white ${minHeightClass}`}
    >
      {loading ? (
        <Loading text={title} size='sm' className='min-h-0 bg-transparent p-0' />
      ) : (
        <div className='mb-4 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-amber-200'>
          Map status
        </div>
      )}
      <h3 className='mt-4 text-lg font-semibold text-white'>{title}</h3>
      <p className='mt-2 max-w-xl text-sm text-slate-300'>{message}</p>
    </div>
  )
}