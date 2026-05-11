import { useRouter } from 'next/router'
import { type ReactNode } from 'react'
import Layout from '@/components/Layout'

const GOOGLE_PLAY_HREF = 'https://play.google.com/store/apps/details?id=com.pushkardev123.VirtualLibrary'
const APP_STORE_HREF = 'https://apps.apple.com/'

const INCLUDED_FEATURES = [
  '24/7 live study rooms',
  'Focus mode and app blocking',
  'Revision tracker with spaced repetition',
  'Daily accountability and rankings',
  'NEET-PG communities and support',
  'PYQs, notes, and custom test practice',
]

const WEB_NEXT_STEPS = [
  'Download the Virtual Library app.',
  'Sign in with the phone number used during checkout.',
  'Open your NEET-PG access and start with a study room or revision session.',
]

export default function V2NeetPgAccessPage() {
  const router = useRouter()
  const status = Array.isArray(router.query.status) ? router.query.status[0] : router.query.status

  const eyebrow =
    status === 'pending'
      ? 'Payment Pending'
      : status === 'failed'
        ? 'Payment Update Needed'
        : 'Access Ready'

  const title =
    status === 'pending'
      ? 'Your payment is still being confirmed.'
      : status === 'failed'
        ? 'We could not confirm your payment.'
        : 'Your Virtual Library access is ready.'

  const description =
    status === 'pending'
      ? 'This usually resolves automatically. Download the app now, then check back from the payment page if access is not visible yet.'
      : status === 'failed'
        ? 'If money was deducted, wait a few minutes and check status again. Otherwise, return to checkout and retry.'
        : 'Download the mobile app and sign in with the same phone number to start using study rooms, focus tools, rankings, notes, and tests.'

  return (
    <Layout
      title="Access Ready - Virtual Library"
      description="Download the Virtual Library app after completing checkout."
    >
      <section
        className="relative overflow-hidden bg-[linear-gradient(118deg,#6021dc_0%,#7932ec_52%,#a58df0_100%)] pt-24 text-white"
      >
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(44,10,112,0.34),rgba(44,10,112,0.04)_58%,rgba(255,255,255,0.10))]" />

        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-8 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_470px] lg:pb-20">
          <div className="pt-4">
            <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase text-white/82 backdrop-blur">
              {eyebrow}
            </div>

            <h1 className="mt-6 max-w-[13ch] text-[3rem] font-black leading-[1.04] tracking-normal md:text-7xl">
              {title}
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-8 text-white/78 md:text-xl">
              {description}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <DownloadOptions variant="light" />
            </div>
          </div>

          <div className="overflow-hidden rounded-[36px] border border-white/18 bg-white/12 p-3 shadow-[0_28px_80px_rgba(28,10,74,0.26)] backdrop-blur sm:p-4">
            <img
              src="/img/banner-right.png"
              alt="Virtual Library live study room preview"
              className="h-full w-full rounded-2xl object-cover"
            />
          </div>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[36px] border border-[#ebe2ff] bg-[#fbf9ff] p-6 shadow-[0_20px_48px_rgba(109,40,217,0.06)] sm:p-8">
            <SectionPill>Included With Your Access</SectionPill>
            <h2 className="mt-5 text-3xl font-bold tracking-normal text-slate-950 md:text-5xl">
              Your NEET-PG study tools are unlocked.
            </h2>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {INCLUDED_FEATURES.map((feature) => (
                <div
                  key={feature}
                  className="flex items-start gap-3 rounded-2xl border border-[#ebe2ff] bg-white px-4 py-4"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#14b8a6] text-[#0f9f91]">
                    <CheckIcon className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-sm font-semibold leading-6 text-slate-700">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[36px] bg-[linear-gradient(100deg,#191827_0%,#351b73_48%,#6d28d9_100%)] p-6 text-white shadow-[0_28px_72px_rgba(31,20,98,0.22)] sm:p-8">
            <SectionPill dark>Next Steps</SectionPill>
            <h2 className="mt-5 text-3xl font-bold tracking-normal md:text-5xl">
              Continue inside the app.
            </h2>

            <div className="mt-8 space-y-4">
              {WEB_NEXT_STEPS.map((step, index) => (
                <div key={step} className="flex gap-4 rounded-2xl border border-white/12 bg-white/10 px-4 py-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-[#5b21b6]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <p className="pt-1 text-sm font-medium leading-7 text-white/78">{step}</p>
                </div>
              ))}
            </div>

            <div className="mt-7">
              <DownloadOptions compact />
            </div>
          </div>
        </div>
      </section>
    </Layout>
  )
}

function SectionPill({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-5 py-2 text-xs font-bold uppercase tracking-normal',
        dark
          ? 'border-[#7c3aed] bg-[#241339] text-[#8f68ff]'
          : 'border-[#b78cff] bg-white text-[#7c3aed]'
      )}
    >
      {children}
    </span>
  )
}

function DownloadOptions({
  compact = false,
  variant = 'glass',
}: {
  compact?: boolean
  variant?: 'glass' | 'light'
}) {
  const isLight = variant === 'light'
  const linkClass = cn(
    'inline-flex items-center justify-center gap-3 rounded-full border text-left transition',
    compact ? 'h-10 min-w-[168px] px-4 py-0' : 'min-w-[178px] px-4 py-3',
    isLight
      ? 'border-white bg-white text-[#5b21b6] shadow-[0_20px_42px_rgba(28,10,74,0.18)] hover:bg-[#f6f1ff]'
      : 'border-white/22 bg-white/12 text-white backdrop-blur hover:bg-white/18'
  )
  const eyebrowClass = isLight ? 'text-[#77669d]' : 'text-white/58'

  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:flex-wrap', compact && 'justify-center')}>
      <a href={GOOGLE_PLAY_HREF} target="_blank" rel="noreferrer" className={linkClass}>
        <PlayStoreIcon className="h-6 w-6 shrink-0" />
        <span>
          <span className={cn('block text-[11px] font-semibold leading-none', eyebrowClass)}>Get it on</span>
          <span className="mt-1 block text-sm font-bold leading-none">Google Play</span>
        </span>
      </a>
      <a href={APP_STORE_HREF} target="_blank" rel="noreferrer" className={linkClass}>
        <AppleIcon className="h-6 w-6 shrink-0" />
        <span>
          <span className={cn('block text-[11px] font-semibold leading-none', eyebrowClass)}>Download on</span>
          <span className="mt-1 block text-sm font-bold leading-none">App Store</span>
        </span>
      </a>
    </div>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path d="M5 10.5l3.2 3.2L15 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  )
}

function PlayStoreIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M4.46 3.21c-.3.19-.46.54-.46 1.01v15.56c0 .48.16.82.46 1.01l8.17-8.8-8.17-8.78Z" />
      <path d="M13.57 11 16.1 8.28 6.17 2.72c-.24-.14-.47-.2-.68-.2l8.08 8.48Z" />
      <path d="M13.57 13 5.49 21.48c.21 0 .44-.06.68-.2l9.93-5.56L13.57 13Z" />
      <path d="M19.49 10.14 17.22 8.87 14.48 12l2.74 3.13 2.27-1.27c.68-.38 1.05-.99 1.05-1.86s-.37-1.48-1.05-1.86Z" />
    </svg>
  )
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M16.52 12.48c-.02-2.02 1.65-2.99 1.72-3.03-.94-1.37-2.4-1.56-2.92-1.58-1.24-.13-2.42.73-3.05.73-.63 0-1.6-.71-2.63-.69-1.35.02-2.59.78-3.29 1.99-1.4 2.43-.36 6.03 1.01 8.01.67.97 1.47 2.06 2.52 2.02 1.01-.04 1.39-.65 2.61-.65 1.22 0 1.56.65 2.63.63 1.08-.02 1.77-.99 2.44-1.97.77-1.12 1.08-2.2 1.1-2.26-.02-.01-2.12-.81-2.14-3.2Z" />
      <path d="M14.51 6.56c.56-.68.94-1.62.83-2.56-.8.03-1.76.53-2.33 1.21-.51.59-.96 1.55-.84 2.46.89.07 1.79-.45 2.34-1.11Z" />
    </svg>
  )
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}
