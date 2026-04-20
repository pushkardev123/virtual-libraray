import Head from 'next/head'
import { useRouter } from 'next/router'

const errorCopy: Record<string, { title: string; message: string }> = {
  HANDOFF_INVALID: {
    title: 'Checkout link expired',
    message: 'This checkout handoff is missing, expired, or already used. Reopen payment from the mobile app to continue.',
  },
}

export default function PaymentErrorPage() {
  const router = useRouter()
  const code = Array.isArray(router.query.code) ? router.query.code[0] : router.query.code
  const content = errorCopy[code || ''] || {
    title: 'Unable to continue',
    message: 'Something prevented checkout from starting. Reopen the app and try again.',
  }

  return (
    <>
      <Head>
        <title>Payment Error - Virtual Library</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="min-h-screen bg-[linear-gradient(180deg,_#fff7ed_0%,_#ffffff_55%,_#f8fafc_100%)] px-4 py-12 text-slate-900 sm:px-6">
        <div className="mx-auto max-w-xl rounded-[2rem] border border-orange-200 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-700">Virtual Library</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{content.title}</h1>
          <p className="mt-4 text-sm leading-6 text-slate-600">{content.message}</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/payment"
              className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Retry payment
            </a>
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-900 transition hover:border-slate-400"
            >
              Back to site
            </a>
          </div>
        </div>
      </div>
    </>
  )
}
