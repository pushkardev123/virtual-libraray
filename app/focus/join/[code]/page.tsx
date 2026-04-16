function sanitizeInviteCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7)
}

export default function Page({
  params,
}: {
  params: { code: string }
}) {
  const code = sanitizeInviteCode(params.code || '')
  const hasValidCode = code.length > 0
  const appUrl = hasValidCode
    ? `virtuallibrary://focus?joinCode=${encodeURIComponent(code)}&autoJoin=1`
    : '#'

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#1f1140] text-white">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/img/banner-bg.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-[#5b1f92]/95 via-[#6b21a8]/92 to-[#2b1a66]/95" />
      <div className="pointer-events-none absolute -top-20 -left-20 h-80 w-80 rounded-full bg-white/15 blur-3xl animate-pulse" />
      <div className="pointer-events-none absolute -bottom-28 -right-20 h-96 w-96 rounded-full bg-fuchsia-300/20 blur-3xl animate-pulse" />

      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl items-center px-5 py-12 sm:px-8">
        <div className="animate-fadeIn w-full max-w-xl rounded-3xl border border-white/25 bg-white/10 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide text-white/90">
            <img src="/img/logo.svg" alt="VirtualLibrary" className="h-4 w-4" />
            VirtualLibrary Focus
          </div>

          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
            Join Focus Session
          </h1>
          <p className="mt-2 text-sm text-violet-100/95 sm:text-base">
            Open this session in the app to auto-join with your invite code.
          </p>

          <div className="mt-6 rounded-2xl border border-white/30 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-violet-200/90">Invite Code</p>
            <p className="mt-2 font-mono text-2xl font-semibold tracking-[0.18em]">
              {code || 'INVALID'}
            </p>
          </div>

          {hasValidCode ? (
            <a
              href={appUrl}
              className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#5b1f92] transition hover:bg-violet-50 sm:text-base"
            >
              Open In VirtualLibrary
            </a>
          ) : (
            <p className="mt-6 rounded-xl border border-rose-300/50 bg-rose-600/20 px-4 py-3 text-sm text-rose-100">
              Invalid session code in URL. Please ask for a fresh invite link.
            </p>
          )}

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a
              href="https://play.google.com/store/apps/details?id=com.pushkardev123.VirtualLibrary"
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center rounded-xl transition hover:bg-black/35 sm:w-auto"
            >
              <img
                src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
                alt="Get it on Google Play"
                className="h-12 w-auto max-w-full"
              />
            </a>
            <a
              href="https://apps.apple.com/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center rounded-xl transition hover:bg-black/35 sm:w-auto"
            >
              <img
                src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
                alt="Download on the App Store"
                className="h-11 w-auto max-w-full"
              />
            </a>
          </div>

          <p className="mt-4 text-xs text-violet-100/90">
            If the app does not open automatically, install it and tap the button again.
          </p>
        </div>
      </section>
    </main>
  )
}
