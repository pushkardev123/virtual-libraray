import { useRouter } from 'next/router'
import { type MouseEvent } from 'react'
import Layout from '@/components/Layout'

const DOWNLOAD_HREF = '#'
const GOOGLE_PLAY_BADGE =
  'https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png'
const APP_STORE_BADGE =
  'https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg'

const INCLUDED_FEATURES = [
  '24/7 virtual study rooms',
  'Exam-specific WhatsApp and Telegram groups',
  'Daily accountability and rankings',
  'Expert-led mental health and mentorship sessions',
  'Focused study community for consistent prep',
  'Support to continue inside the Virtual Library app',
]

const WEB_NEXT_STEPS = [
  'Download the Virtual Library app from Google Play or the App Store.',
  'Share your payment screenshot on WhatsApp at +91 79744 25107.',
  'You will be added to the relevant groups within 4–6 hours.',
  'Access details and the next instructions will be shared there.',
]

export default function V2NeetPgAccessPage() {
  const router = useRouter()
  const status = Array.isArray(router.query.status) ? router.query.status[0] : router.query.status

  const eyebrow =
    status === 'pending'
      ? 'Payment Pending'
      : status === 'failed'
        ? 'Payment Update Needed'
        : 'Payment Completed'

  const title =
    status === 'pending'
      ? 'Your payment is being confirmed.'
      : status === 'failed'
        ? 'We could not confirm your payment.'
        : 'Your Virtual Library access is ready to continue in the app.'

  const description =
    status === 'pending'
      ? 'Keep your payment screenshot ready and download the app while the team completes final confirmation.'
      : status === 'failed'
        ? 'If payment did not go through, return to checkout and retry. If it did, contact the team with your payment screenshot.'
        : 'Signup and payment are complete on web. Download the app and follow the next steps below to start using the full experience.'

  return (
    <Layout
      title="Continue in the App - Virtual Library"
      description="Post-payment access page for Virtual Library web checkouts."
    >
      <section
        className="relative overflow-hidden bg-[#6b21a8] pt-28 text-white"
        style={{
          backgroundImage: "url('/img/banner-bg.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#6b21a8]/95 via-[#6b21a8]/90 to-[#6b21a8]/80" />

        <div className="relative z-10 mx-auto grid max-w-6xl gap-8 px-5 pb-20 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-6">
          <div className="pt-4">
            <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-5 py-2 text-sm font-medium">
              {eyebrow}
            </div>

            <h1 className="mt-6 max-w-[12ch] text-5xl font-semibold leading-[1.02] md:text-7xl">
              {title}
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-200 md:text-lg">
              {description}
            </p>

            <div className="mt-8 rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur sm:p-7">
              <p className="text-xs uppercase tracking-wide text-slate-200">Download App</p>
              <p className="mt-2 max-w-lg text-xl font-medium leading-8 text-white">
                Continue your study flow inside Virtual Library.
              </p>
              <p className="mt-2 max-w-lg text-sm leading-6 text-slate-200">
                The web checkout is complete. The day-to-day experience lives in the app.
              </p>
              <div className="mt-5">
                <DownloadBadges />
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/15 bg-white/10 p-3 backdrop-blur sm:p-4">
            <img
              src="/img/banner-right.png"
              alt="Virtual Library app preview"
              className="h-full w-full rounded-2xl object-cover"
            />
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-3xl border border-purple-100 bg-[#faf7ff] p-8 shadow-sm">
            <div className="mb-5 inline-block rounded-full border border-purple-300 px-5 py-2 text-sm font-medium text-purple-600">
              Included
            </div>
            <h2 className="text-3xl font-semibold leading-tight text-gray-900 md:text-4xl">
              What opens after your payment
            </h2>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {INCLUDED_FEATURES.map((feature) => (
                <div
                  key={feature}
                  className="flex items-center gap-3 rounded-2xl border border-purple-100 bg-white px-4 py-4"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-purple-700">
                    ✓
                  </span>
                  <span className="text-sm font-medium text-slate-700">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
            <div className="mb-5 inline-block rounded-full border border-purple-300 px-5 py-2 text-sm font-medium text-purple-600">
              Next Steps
            </div>
            <h2 className="text-3xl font-semibold leading-tight text-gray-900 md:text-4xl">
              What to do now
            </h2>

            <div className="mt-8 space-y-4">
              {WEB_NEXT_STEPS.map((step, index) => (
                <div key={step} className="flex gap-4 rounded-2xl border border-slate-100 bg-[#fcfbff] px-4 py-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-600 text-sm font-semibold text-white">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <p className="pt-1 text-sm leading-7 text-slate-700">{step}</p>
                </div>
              ))}
            </div>

            <a
              href="https://wa.me/917974425107"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center rounded-full bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Contact on WhatsApp
            </a>
          </div>
        </div>
      </section>
    </Layout>
  )
}

function DownloadBadges() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <a href={DOWNLOAD_HREF} onClick={preventPlaceholderNavigation} className="inline-flex items-center">
        <img
          src={GOOGLE_PLAY_BADGE}
          alt="Get it on Google Play"
          className="h-14 w-auto max-w-full"
        />
      </a>
      <a href={DOWNLOAD_HREF} onClick={preventPlaceholderNavigation} className="inline-flex items-center">
        <img
          src={APP_STORE_BADGE}
          alt="Download on the App Store"
          className="h-10 w-auto max-w-full"
        />
      </a>
    </div>
  )
}

function preventPlaceholderNavigation(event: MouseEvent<HTMLAnchorElement>) {
  if (DOWNLOAD_HREF === '#') {
    event.preventDefault()
  }
}
