import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchPublicTutorials } from '../../lib/tutorialService'

// Turns a pasted YouTube / Vimeo link into its embeddable form. Anything else
// (a direct .mp4, another host) is returned as-is and shown as a plain link
// or <video>, so an unrecognised URL never ends up inside an iframe.
function toEmbed(url) {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') return { kind: 'iframe', src: `https://www.youtube.com/embed/${u.pathname.slice(1)}` }
    if (host.endsWith('youtube.com')) {
      const id = u.searchParams.get('v') || (u.pathname.match(/\/(?:embed|shorts)\/([\w-]+)/) || [])[1]
      if (id) return { kind: 'iframe', src: `https://www.youtube.com/embed/${id}` }
    }
    if (host === 'vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean)[0]
      if (/^\d+$/.test(id)) return { kind: 'iframe', src: `https://player.vimeo.com/video/${id}` }
    }
    if (/\.(mp4|webm|ogg)$/i.test(u.pathname)) return { kind: 'video', src: url }
  } catch {
    // fall through to a plain link
  }
  return { kind: 'link', src: url }
}

function TutorialVideo({ url, title }) {
  const embed = toEmbed(url)
  if (embed.kind === 'iframe') {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
        <iframe
          src={embed.src}
          title={title}
          className="h-full w-full"
          allow="accelerometer; encrypted-media; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
    )
  }
  if (embed.kind === 'video') {
    return <video src={embed.src} controls preload="metadata" className="aspect-video w-full rounded-xl bg-black" />
  }
  return (
    <a href={embed.src} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-blue-700 underline">
      Watch video
    </a>
  )
}

// Read-only list of admin-published tutorials for one audience. Shared by the
// seller panel and the customer help center.
export function TutorialsPanel({ audience }) {
  const { data: items = [], isLoading, isError } = useQuery({
    queryKey: ['tutorials', audience],
    queryFn: () => fetchPublicTutorials(audience),
  })
  const [openId, setOpenId] = useState(null)

  if (isLoading) return <p className="text-xs text-slate-500">Loading tutorials…</p>
  if (isError) return <p className="text-xs text-slate-500">Could not load tutorials. Please try again later.</p>
  if (items.length === 0) return <p className="text-xs text-slate-500">No tutorials have been published yet.</p>

  return (
    <div className="flex flex-col gap-3">
      {items.map((t) => {
        const isOpen = openId === t.id
        return (
          <div key={t.id} className="rounded-2xl border border-slate-200 bg-white shadow-xs">
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : t.id)}
              className="flex w-full items-center justify-between gap-3 p-4 text-left cursor-pointer"
              aria-expanded={isOpen}
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">{t.title}</p>
                <p className="mt-0.5 text-2xs text-slate-500">
                  {t.category}
                  {t.videoUrl ? ' · Video' : ''}
                  {t.description ? ' · Steps' : ''}
                </p>
              </div>
              <span className="text-slate-400">{isOpen ? '−' : '+'}</span>
            </button>
            {isOpen && (
              <div className="space-y-3 border-t border-slate-100 p-4">
                {t.videoUrl && <TutorialVideo url={t.videoUrl} title={t.title} />}
                {t.description && (
                  <p className="whitespace-pre-line text-xs leading-relaxed text-slate-700">{t.description}</p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
