import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState, type ReactNode } from 'react'
import {
  apiFetch,
  BillingPlan,
  formatCurrency,
  PublicBillingPlansResponse,
} from '@/lib/payment-client'

const GOOGLE_PLAY_HREF = 'https://play.google.com/store/apps/details?id=com.pushkardev123.VirtualLibrary'
const APP_STORE_HREF = 'https://apps.apple.com/'

type FeatureSection = {
  title: string
  subtitle: string
  description: string
  cta: string
  image: string
  alt: string
  reverse?: boolean
}
type MoreFeature = {
  title: string
  description: string
  tone: string
  icon: 'rankings' | 'support' | 'communities' | 'progress'
}
type HeroStat = {
  value: string
  label: string
  suffix?: string
  accent?: boolean
  leadingDot?: boolean
}
const NAV_ITEMS = [
  { label: 'Features', id: 'features' },
  { label: 'Plans', id: 'pricing' },
  { label: 'Why Us', id: 'why-virtual-library' },
  { label: '3 Steps', id: 'steps' },
]

const HERO_COPY = {
  title: 'Struggling To Stay Consistent With Your Studies From Home?',
  description:
    'Join Virtual Library where 3000+ students show up every day, keep each other accountable, and stay focused with 24/7 live study rooms, focus mode app blocker, and many more.',
  image: '/img/v2/hero-section-illustration.png',
  alt: 'Virtual Library app preview showing live study room and practice notes',
}

const HERO_STATS: HeroStat[] = [
  { value: '2.5K', suffix: '+', label: 'App Downloads' },
  { value: '70%', label: 'Female Members' },
  { value: '3000+', label: 'Aspirants study daily' },
  { value: '825+', label: 'Focusing right now', accent: true, leadingDot: true },
]

const FEATURE_SECTIONS: FeatureSection[] = [
  {
    title: 'Virtual Study Rooms',
    subtitle: '24-Hour Active Zoom Study Sessions.',
    description:
      'Study anytime with dedicated learners in our always-active Zoom sessions. Build consistency, stay accountable, and achieve more alongside like-minded students.',
    cta: 'Join Study Room',
    image: '/img/v2/Studying-rafiki.svg',
    alt: 'Student using Virtual Library study room',
  },
  {
    title: 'Focus Zone',
    subtitle: 'Block distractions and study with attention.',
    description:
      'Built-in timer with deep focus mode. Automatically block social media apps while you study and keep your prep anchored to real study hours.',
    cta: 'Try Deep Focus Mode',
    image: '/img/v2/Time management-amico.svg',
    alt: 'Focus mode illustration',
    reverse: true,
  },
  {
    title: 'Revision Tracker (Spaced Repetition)',
    subtitle: 'Revise on time, remember for longer.',
    description:
      'Track what you studied today, get customizable reminders automatically, and revise smarter with spaced repetition built for long-term retention.',
    cta: 'Save A Note',
    image: '/img/v2/Mobile note list-pana.svg',
    alt: 'Revision tracker illustration',
  },
]

const MORE_FEATURES: MoreFeature[] = [
  {
    title: 'Rankings',
    description: 'Compare ranks with others and grow together.',
    tone: 'bg-[#fff6d8] text-[#d49a00]',
    icon: 'rankings',
  },
  {
    title: 'Support Sessions',
    description: 'Expert-led sessions for mental health and support.',
    tone: 'bg-[#ffe5eb] text-[#e8415d]',
    icon: 'support',
  },
  {
    title: 'Communities',
    description: 'Explore WhatsApp and Telegram communities.',
    tone: 'bg-[#ddffd0] text-[#34a853]',
    icon: 'communities',
  },
  {
    title: 'Progress and Goals',
    description: 'View progress or edit your future goals.',
    tone: 'bg-[#efecff] text-[#6d5cff]',
    icon: 'progress',
  },
]

const FLOW_STEPS = [
  {
    id: '1',
    title: 'Choose a plan',
    description:
      'Pick the subscription duration that matches your prep window.',
  },
  {
    id: '2',
    title: 'Complete billing',
    description:
      'Verify your phone number, add billing details, and continue through Razorpay.',
  },
  {
    id: '3',
    title: 'Download the app',
    description:
      'Download Virtual Library and start using study rooms, focus tools, rankings, and support.',
  },
]

const WHO_CAN_JOIN = [
  'Students preparing for competitive exams',
  'College students managing daily study routines',
  'Working professionals studying alongside a job',
  'Anyone who struggles with consistency, focus, or accountability',
]

const TESTIMONIAL = {
  image: '/img/Dr.Deepak_Aanjna.jpeg',
  name: 'Dr. Deepak Aanjna',
  quote:
    'Focus mode changed everything for me. I stopped wasting study blocks and finally built the consistency I needed for serious preparation.',
  result: '12h 35m',
  meta: 'Best focus day',
  pill: 'Focus mode',
}

export default function V2NeetPgPage() {
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [pricingPlans, setPricingPlans] = useState<BillingPlan[]>([])
  const [pricingLoading, setPricingLoading] = useState(true)
  const [pricingError, setPricingError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadPublicPlans() {
      setPricingLoading(true)
      setPricingError('')

      try {
        const response = await apiFetch<PublicBillingPlansResponse>('/billing/plans/public', {
          headers: {
            Accept: 'application/json',
          },
        })

        if (!isMounted) {
          return
        }

        setPricingPlans(sortPlans(response.plans || []))
      } catch (error) {
        if (!isMounted) {
          return
        }

        setPricingPlans([])
        setPricingError(getErrorMessage(error, 'Unable to load prices right now. Please try again.'))
      } finally {
        if (isMounted) {
          setPricingLoading(false)
        }
      }
    }

    void loadPublicPlans()

    return () => {
      isMounted = false
    }
  }, [])

  async function handleSelectPlan(plan: BillingPlan) {
    await router.push({
      pathname: '/payment',
      query: {
        source: 'v2-neet-pg',
        planId: plan.planId,
      },
    })
  }

  function retryLoadPublicPlans() {
    setPricingLoading(true)
    setPricingError('')

    void apiFetch<PublicBillingPlansResponse>('/billing/plans/public', {
      headers: {
        Accept: 'application/json',
      },
    })
      .then((response) => {
        setPricingPlans(sortPlans(response.plans || []))
      })
      .catch((error) => {
        setPricingPlans([])
        setPricingError(getErrorMessage(error, 'Unable to load prices right now. Please try again.'))
      })
      .finally(() => setPricingLoading(false))
  }

  function scrollToSection(sectionId: string, offset = 96) {
    if (typeof window === 'undefined') {
      return
    }

    const target = document.getElementById(sectionId)

    if (!target) {
      return
    }

    const top = target.getBoundingClientRect().top + window.scrollY - offset
    window.scrollTo({
      top: Math.max(0, top),
      behavior: 'smooth',
    })
  }

  function openSection(sectionId: string, offset = 96) {
    setMobileMenuOpen(false)
    scrollToSection(sectionId, offset)
  }

  return (
    <>
      <Head>
        <title>Study From Home - Virtual Library</title>
        <meta
          name="description"
          content="A focused Virtual Library experience for students who want study rooms, accountability, focus tools, rankings, and app-based progress."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-white text-slate-900">
        <header className="fixed inset-x-0 top-0 z-50 border-b border-[#ece6f8] bg-[#fbf9ff]/95 backdrop-blur">
          <div className="mx-auto flex h-16 items-center justify-between px-4 sm:px-10">
            <Link href="/" className="flex items-center">
              <img src="/img/logo.svg" alt="Virtual Library" className="h-8 w-auto sm:h-9" />
            </Link>

            <nav className="hidden items-center gap-6 lg:flex">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openSection(item.id, 80)}
                  className="text-sm font-semibold text-[#34364a] transition hover:text-[#6d28d9]"
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="hidden items-center gap-3 md:flex">
              <button
                type="button"
                onClick={() => openSection('pricing', 80)}
                className="inline-flex h-10 items-center justify-center rounded-full border border-[#d6cde8] px-5 text-sm font-bold text-[#191827] transition hover:border-[#6d28d9] hover:text-[#6d28d9]"
              >
                View Plans
              </button>
              <button
                type="button"
                onClick={() => openSection('download-app', 96)}
                className="inline-flex h-10 items-center justify-center rounded-full bg-[#6d28d9] px-5 text-sm font-bold text-white shadow-[0_14px_30px_rgba(109,40,217,0.22)] transition hover:bg-[#5b21b6]"
              >
                Download App
              </button>
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((value) => !value)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#ded5f1] text-[#34364a] md:hidden"
              aria-label="Toggle menu"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6">
                <path
                  d={mobileMenuOpen ? 'M6 6l12 12M18 6L6 18' : 'M4 8h16M4 16h16'}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </button>
          </div>

          {mobileMenuOpen && (
            <div className="border-t border-[#ece6f8] bg-white px-4 py-3 md:hidden">
              <div className="flex flex-col gap-2">
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openSection(item.id, 80)}
                    className="rounded-xl px-3 py-2 text-left text-sm font-semibold text-[#34364a]"
                  >
                    {item.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => openSection('download-app', 96)}
                  className="rounded-xl bg-[#6d28d9] px-3 py-2 text-left text-sm font-bold text-white"
                >
                  Download App
                </button>
              </div>
            </div>
          )}
        </header>

        <main className="pt-16">
          <section className="bg-[#f8f4ff]">
            <div className="mx-auto overflow-hidden bg-[linear-gradient(118deg,#6021dc_0%,#7932ec_52%,#a58df0_100%)] text-white shadow-[0_28px_80px_rgba(69,31,149,0.24)] lg:h-[calc(100svh-4rem)]">
              <div className="relative flex flex-col overflow-hidden lg:h-full lg:min-h-0">
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(44,10,112,0.34),rgba(44,10,112,0.04)_58%,rgba(255,255,255,0.10))]" />

                <div className="relative z-10 mx-auto grid w-full max-w-[1390px] flex-1 items-center gap-5 px-4 pb-0 pt-5 sm:px-8 sm:pt-10 lg:min-h-0 lg:grid-cols-[0.92fr_1.08fr] lg:gap-0 lg:py-0 xl:px-10">
                  <div className="max-w-[43rem] pb-1 lg:pb-8">
                    <p className="mb-4 inline-flex max-w-full rounded-full border border-white/20 bg-white/10 px-3 py-2 text-[10px] font-bold uppercase leading-none text-white/82 backdrop-blur sm:px-4 sm:text-xs">
                      Virtual Library for focused study
                    </p>
                    <h1 className="max-w-[20rem] text-[2.15rem] font-black leading-[1.08] tracking-normal max-[380px]:text-[1.95rem] sm:max-w-[42rem] sm:text-[3.2rem] lg:text-[3rem]">
                      {HERO_COPY.title}
                    </h1>

                    <p className="mt-4 max-w-[22rem] text-sm leading-6 text-white/78 sm:max-w-[39rem] sm:text-lg sm:leading-8 lg:text-xl lg:leading-8 xl:text-[1.28rem] xl:leading-8">
                      {HERO_COPY.description}
                    </p>

                    <div className="mt-7 flex w-full max-w-[22rem] flex-col gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center">
                      <button
                        type="button"
                        onClick={() => openSection('pricing', 80)}
                        className="inline-flex h-10 font-semibold w-full min-w-[170px] items-center justify-center rounded-full bg-white px-8 text-base text-[#5b21b6] shadow-[0_20px_42px_rgba(28,10,74,0.24)] transition hover:bg-[#f6f1ff] sm:w-auto"
                      >
                        Enroll Now
                      </button>
                      <div id="download-app">
                        <DownloadOptions compact variant="light" />
                      </div>
                    </div>
                  </div>

                  <div className="relative flex w-full items-end justify-center self-end overflow-visible pt-2 lg:h-full lg:min-h-0 lg:justify-end lg:pt-0">
                    <img
                      src={HERO_COPY.image}
                      alt={HERO_COPY.alt}
                      className="relative z-10 h-auto w-full max-w-[300px] object-contain sm:max-w-[590px] lg:absolute lg:bottom-[-1px] lg:right-[-7vw] lg:max-h-[96%] lg:w-auto lg:max-w-none xl:right-[-2rem] xl:max-h-[99%]"
                    />
                  </div>
                </div>

                <div className="relative z-20 bg-black px-4 py-3 text-white">
                  <div className="mx-auto grid max-w-7xl grid-cols-2 gap-y-5 sm:grid-cols-4">
                    {HERO_STATS.map((item, index) => (
                      <div
                        key={item.label}
                        className={cn(
                          'px-3 text-center sm:px-6',
                          index !== 0 && 'sm:border-l sm:border-white/10'
                        )}
                      >
                        <p
                          className={cn(
                            'text-3xl font-black leading-none tracking-normal sm:text-4xl',
                            item.accent ? 'text-[#00d7a0]' : 'text-white'
                          )}
                        >
                          {item.leadingDot && <span className="mr-1 text-[#00d7a0]">•</span>}
                          {item.value}
                          {item.suffix && <span className="text-[#00d7a0]">{item.suffix}</span>}
                        </p>
                        <p className="mt-2 text-xs font-semibold leading-5 text-[#d8d3eb] sm:text-sm">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="pricing" className="scroll-mt-24 bg-white py-16 sm:py-20">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <div className="mx-auto max-w-3xl text-center">
                <SectionPill>Plans</SectionPill>
                <h2 className="mt-6 text-4xl font-bold tracking-normal text-slate-950 md:text-6xl">
                  Pick your Virtual Library access.
                </h2>
                <p className="mt-4 text-lg leading-8 text-[#5a5d78]">
                  Choose a plan here, then finish OTP and billing on the next screen. Every plan
                  unlocks daily study rooms, structured revision notes, live rankings, and community access.
                </p>
              </div>

              {pricingLoading && (
                <div className="mt-12 rounded-[30px] border border-[#ebe2ff] bg-[#fbf9ff] px-6 py-12 text-center">
                  <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#e6dbff] border-t-[#7c3aed]" />
                  <p className="mt-5 text-sm font-semibold text-[#5a5d78]">Loading current prices...</p>
                </div>
              )}

              {!pricingLoading && pricingError && (
                <div className="mt-12 rounded-[30px] border border-rose-200 bg-rose-50 px-6 py-8 text-center">
                  <p className="text-sm font-semibold text-rose-700">{pricingError}</p>
                  <button
                    type="button"
                    onClick={retryLoadPublicPlans}
                    className="mt-5 inline-flex items-center justify-center rounded-2xl bg-[#6d28d9] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#5b21b6]"
                  >
                    Reload prices
                  </button>
                </div>
              )}

              {!pricingLoading && !pricingError && pricingPlans.length > 0 && (
                <div className="mt-12 flex flex-wrap justify-center gap-5">
                  {pricingPlans.map((plan, index) => (
                    <div
                      key={plan.planId}
                      className="flex w-full max-w-[400px] md:w-[calc(50%-0.625rem)] md:max-w-none xl:w-[calc(33.333%-0.834rem)]"
                    >
                      <PricingPlanCard
                        plan={plan}
                        meta={getPricingPlanMeta(plan, pricingPlans)}
                        tilt={index % 2 === 0 ? 'left' : 'right'}
                        onSelect={handleSelectPlan}
                      />
                    </div>
                  ))}
                </div>
              )}

              {!pricingLoading && !pricingError && pricingPlans.length === 0 && (
                <div className="mt-12 rounded-[30px] border border-[#ebe2ff] bg-[#fbf9ff] px-6 py-10 text-center">
                  <p className="text-sm font-semibold text-[#5a5d78]">
                    No public plans are available right now.
                  </p>
                  <button
                    type="button"
                    onClick={retryLoadPublicPlans}
                    className="mt-5 inline-flex items-center justify-center rounded-2xl bg-[#6d28d9] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#5b21b6]"
                  >
                    Check again
                  </button>
                </div>
              )}
            </div>
          </section>

          <section id="features" className="bg-white py-16 sm:py-20">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <div className="mx-auto max-w-3xl text-center">
                <SectionPill>Everything You Need</SectionPill>
                <h2 className="mt-6 text-4xl font-bold tracking-normal text-slate-950 md:text-6xl">
                  Built for <span className="text-[#7c3aed]">Serious Students</span>
                </h2>
                <p className="mt-4 text-lg leading-8 text-[#5a5d78]">
                  Every feature is designed to keep you consistent, focused, and accountable.
                </p>
              </div>

              <div className="mt-16 space-y-14">
                {FEATURE_SECTIONS.map((section) => (
                  <div
                    key={section.title}
                    className={cn(
                      'grid items-center gap-10 lg:grid-cols-2',
                      section.reverse && 'lg:[&>*:first-child]:order-2 lg:[&>*:last-child]:order-1'
                    )}
                  >
                    <div className="rounded-[32px] border border-[#f0e8ff] bg-[#fbf9ff] p-6 shadow-[0_20px_48px_rgba(109,40,217,0.06)]">
                      <img src={section.image} alt={section.alt} className="mx-auto h-auto w-full max-w-[460px]" />
                    </div>

                    <div>
                      <h3 className="text-4xl font-bold tracking-normal text-slate-950 md:text-5xl">
                        {section.title}
                      </h3>
                      <p className="mt-5 text-2xl font-medium text-[#5a37a8]">{section.subtitle}</p>
                      <p className="mt-5 max-w-xl text-lg leading-8 text-[#5a5d78]">
                        {section.description}
                      </p>

                      <button
                        type="button"
                        onClick={() => openSection('pricing')}
                        className="mt-8 inline-flex min-w-[240px] items-center justify-center rounded-2xl bg-[linear-gradient(90deg,#6d28d9,#8b5cf6)] px-8 py-4 text-lg font-semibold text-white shadow-[0_18px_38px_rgba(109,40,217,0.20)] transition hover:opacity-95"
                      >
                        {section.cta}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="bg-white pb-20">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <h2 className="text-4xl font-bold tracking-normal text-slate-950">
                <span className="mr-2 text-[#7c3aed]">•</span>
                More From Virtual Library
              </h2>

              <div className="mt-10 grid gap-4 md:grid-cols-2">
                {MORE_FEATURES.map((feature) => (
                  <div
                    key={feature.title}
                    className="flex items-start gap-4 rounded-[28px] border border-[#ebe2ff] bg-white px-6 py-6 shadow-[0_20px_48px_rgba(109,40,217,0.05)]"
                  >
                    <div className={cn('flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl', feature.tone)}>
                      <FeatureIcon icon={feature.icon} />
                    </div>
                    <div>
                      <h3 className="text-3xl font-bold tracking-normal text-[#7c3aed]">
                        {feature.title}
                      </h3>
                      <p className="mt-2 text-lg leading-7 text-[#5a5d78]">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="bg-[#fbf9ff] py-16 sm:py-20">
            <div className="mx-auto grid max-w-7xl items-start gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <SectionPill>Who Can Join</SectionPill>
                <h2 className="mt-6 max-w-lg text-4xl font-bold tracking-normal text-slate-950 md:text-6xl">
                  Anyone who wants to stay consistent with their studies.
                </h2>
              </div>

              <div className="grid gap-4">
                {WHO_CAN_JOIN.map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-4 rounded-[24px] border border-[#ebe2ff] bg-white px-5 py-5 shadow-[0_18px_44px_rgba(109,40,217,0.05)]"
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#6d28d9] text-white">
                      <CheckIcon className="h-4 w-4" />
                    </span>
                    <p className="text-lg font-semibold leading-7 text-slate-800">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="steps" className="bg-white py-16 sm:py-20">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <div className="mx-auto max-w-4xl text-center">
                <SectionPill>Simple Process</SectionPill>
                <h2 className="mt-6 text-4xl font-bold tracking-normal text-slate-950 md:text-6xl">
                  Start Studying <span className="text-[#7c3aed]">In 3 Steps</span>
                </h2>
                <p className="mt-4 text-lg leading-8 text-[#5a5d78]">
                  No complicated setup. Join, study, and keep your routine moving.
                </p>
              </div>

              <div className="relative mt-16 hidden lg:block">
                <div className="absolute left-[16.66%] right-[16.66%] top-7 h-px bg-[#cdb4ff]" />
                <div className="grid grid-cols-3 gap-8">
                  {FLOW_STEPS.map((step, index) => (
                    <div key={step.id} className="text-center">
                      <div
                        className={cn(
                          'mx-auto flex h-16 w-16 items-center justify-center rounded-full border-4 text-3xl font-bold',
                          index === 0 && 'border-[#7c3aed] bg-[#7c3aed] text-white shadow-[0_14px_28px_rgba(124,58,237,0.28)]',
                          index === 1 && 'border-[#7c3aed] bg-white text-[#7c3aed]',
                          index === 2 && 'border-[#20c997] bg-white text-[#20c997]'
                        )}
                      >
                        {step.id}
                      </div>
                      <h3 className="mt-10 text-3xl font-bold tracking-normal text-slate-950">
                        {step.title}
                      </h3>
                      <p className="mt-4 text-lg leading-8 text-[#5a5d78]">{step.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-12 grid gap-6 lg:hidden">
                {FLOW_STEPS.map((step, index) => (
                  <div key={step.id} className="rounded-[28px] border border-[#ebe2ff] bg-[#fbf9ff] p-6 text-center">
                    <div
                      className={cn(
                        'mx-auto flex h-14 w-14 items-center justify-center rounded-full border-4 text-2xl font-bold',
                        index === 0 && 'border-[#7c3aed] bg-[#7c3aed] text-white',
                        index === 1 && 'border-[#7c3aed] bg-white text-[#7c3aed]',
                        index === 2 && 'border-[#20c997] bg-white text-[#20c997]'
                      )}
                    >
                      {step.id}
                    </div>
                    <h3 className="mt-5 text-2xl font-bold tracking-normal text-slate-950">
                      {step.title}
                    </h3>
                    <p className="mt-3 text-base leading-7 text-[#5a5d78]">{step.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="why-virtual-library" className="bg-[#140d1f] py-16 text-white sm:py-20">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <div className="text-center">
                <SectionPill dark>Success Stories</SectionPill>
                <h2 className="mt-6 text-5xl font-bold tracking-normal md:text-7xl">
                  Why Virtual Library?
                </h2>
                <p className="mt-4 text-3xl font-semibold text-[#8f68ff] md:text-5xl">
                  Trusted by students who study every day.
                </p>
              </div>

              <div className="mt-14 flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => openSection('pricing')}
                  className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-full border border-white/50 text-white lg:flex"
                  aria-label="Open plans"
                >
                  <ArrowLeftIcon className="h-7 w-7" />
                </button>

                <div className="flex-1 rounded-[36px] bg-[#1b112c] p-8 shadow-[0_28px_70px_rgba(7,5,16,0.32)]">
                  <div className="grid items-center gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
                    <div className="overflow-hidden rounded-[28px] bg-[#f4bb32]">
                      <img
                        src={TESTIMONIAL.image}
                        alt={TESTIMONIAL.name}
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-4">
                        <h3 className="text-4xl font-bold tracking-normal">{TESTIMONIAL.name}</h3>
                        <span className="text-3xl text-[#f59e0b]">★★★★★</span>
                      </div>
                      <p className="mt-5 text-2xl font-semibold italic leading-10 text-white/95">
                        “ {TESTIMONIAL.quote} ”
                      </p>
                      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <p className="text-4xl font-bold tracking-normal">{TESTIMONIAL.result}</p>
                          <p className="mt-2 text-xl text-white/60">{TESTIMONIAL.meta}</p>
                        </div>
                        <span className="rounded-full border border-[#7c3aed] px-5 py-2 text-base font-semibold text-[#8f68ff]">
                          {TESTIMONIAL.pill}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openSection('pricing')}
                  className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-full border border-white/50 text-white lg:flex"
                  aria-label="Open plans"
                >
                  <ArrowRightIcon className="h-7 w-7" />
                </button>
              </div>
            </div>
          </section>

          <section className="bg-white py-16 sm:py-20">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <div className="rounded-[36px] bg-[linear-gradient(100deg,#191827_0%,#351b73_48%,#6d28d9_100%)] px-6 py-12 text-center text-white shadow-[0_28px_72px_rgba(31,20,98,0.22)] sm:px-10">
                <p className="text-xs font-bold uppercase tracking-normal text-white/55">Get started in the app</p>
                <h2 className="mt-4 text-4xl font-bold tracking-normal md:text-6xl">
                  Build a study routine that keeps showing up.
                </h2>
                <p className="mt-4 text-lg leading-8 text-white/72 md:text-2xl">
                  Join students already using Virtual Library for focus rooms, accountability, and daily progress.
                </p>

                <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row sm:flex-wrap">
                  <button
                    type="button"
                    onClick={() => openSection('pricing', 80)}
                    className="inline-flex min-w-[220px] items-center justify-center rounded-full bg-white px-8 py-2 text-lg font-bold text-[#22143f] transition hover:bg-slate-100"
                  >
                    View Plans
                  </button>
                  <DownloadOptions compact />
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="bg-[#f5f5f8]">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
            <div className="grid gap-10 lg:grid-cols-[1.4fr_0.9fr_0.9fr_0.9fr]">
              <div>
                <img src="/img/logo.svg" alt="Virtual Library" className="h-14 w-auto" />
                <div className="mt-6 flex flex-wrap gap-3">
                  {['in', 'ig', 'yt', 'x'].map((item) => (
                    <span
                      key={item}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-semibold uppercase text-slate-500"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <FooterGroup
                title="About Us"
                links={[
                  { label: 'Company Info', href: '/about' },
                  { label: 'Contact Us', href: '/contact' },
                ]}
              />
              <FooterGroup
                title="Learn with Us"
                links={[
                  { label: 'Learning Methods', href: '#features' },
                  { label: 'Expert Tutors', href: '#why-virtual-library' },
                ]}
              />
              <FooterGroup
                title="Discover"
                links={[
                  { label: 'Support Center', href: '/contact' },
                ]}
              />
            </div>

            <div className="mt-12 flex flex-col gap-6 border-t border-slate-200 pt-6 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
              <p>© 2026 Virtual Library. All rights reserved.</p>
              <div className="flex flex-wrap gap-4 md:gap-8">
                <a href="/privacy-policy" className="transition hover:text-[#6d28d9]">
                  Privacy Policy
                </a>
                <a href="/terms-and-conditions" className="transition hover:text-[#6d28d9]">
                  Terms & Conditions
                </a>
                <a href="/refund-policy" className="transition hover:text-[#6d28d9]">
                  Refund Policy
                </a>
              </div>
            </div>
          </div>
        </footer>

      </div>
    </>
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

type PricingPlanMeta = {
  badge: string | null
  highlight: boolean
  summary: string
}

function sortPlans(plans: BillingPlan[]) {
  return [...plans].sort((left, right) => {
    if ((left.course.displayOrder || 0) !== (right.course.displayOrder || 0)) {
      return (left.course.displayOrder || 0) - (right.course.displayOrder || 0)
    }

    if (left.durationMonths !== right.durationMonths) {
      return left.durationMonths - right.durationMonths
    }

    return left.amountPaise - right.amountPaise
  })
}

function getPricingPlanMeta(plan: BillingPlan, plans: BillingPlan[]): PricingPlanMeta {
  const sortedPlans = sortPlans(plans)
  const longestPlan = sortedPlans[sortedPlans.length - 1]
  const recommendedPlan =
    sortedPlans.find((candidate) => candidate.durationMonths === 12) ||
    sortedPlans[Math.min(1, sortedPlans.length - 1)] ||
    sortedPlans[0]

  if (longestPlan?.planId === plan.planId && sortedPlans.length > 2) {
    return {
      badge: 'Best Deal',
      highlight: recommendedPlan?.planId !== plan.planId,
      summary: 'Best value for extended preparation',
    }
  }

  if (recommendedPlan?.planId === plan.planId) {
    return {
      badge: 'Most Popular',
      highlight: true,
      summary: 'Recommended for consistent study routines',
    }
  }

  if (plan.durationMonths <= 6) {
    return {
      badge: null,
      highlight: false,
      summary: 'Structured access for focused preparation',
    }
  }

  return {
    badge: null,
    highlight: false,
    summary: 'Flexible access for your prep window',
  }
}

function formatPlanName(plan: BillingPlan) {
  if (plan.name?.trim()) {
    return plan.name.trim()
  }

  return `${formatDuration(plan.durationMonths)} Plan`
}

function formatDuration(durationMonths: number) {
  if (durationMonths === 1) {
    return '1 month'
  }

  if (durationMonths % 12 === 0) {
    const years = durationMonths / 12
    return `${years} ${years === 1 ? 'year' : 'years'}`
  }

  return `${durationMonths} months`
}

function getPlanFeatures(plan: BillingPlan) {
  const coreFeatures = [
    'Daily study rooms with built-in focus tools',
    'Revision notes powered by spaced repetition',
    'Live rankings for consistent accountability',
    'Communities access for peer learning and support',
  ]

  if (plan.durationMonths >= 24) {
    return [...coreFeatures, 'Priority long-term preparation access']
  }

  if (plan.durationMonths >= 12) {
    return [...coreFeatures, 'Best fit for full-cycle preparation']
  }

  return [...coreFeatures, 'Flexible access for focused preparation']
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    const message = error.message?.trim()

    if (message && !/<(?:!doctype|html|head|body|script)\b/i.test(message) && message.length < 180) {
      return message
    }
  }

  return fallback
}

function PricingPlanCard({
  meta,
  onSelect,
  plan,
  tilt,
}: {
  meta: PricingPlanMeta
  plan: BillingPlan
  tilt: 'left' | 'right'
  onSelect: (plan: BillingPlan) => void
}) {
  const durationLabel = formatDuration(plan.durationMonths)
  const features = getPlanFeatures(plan)

  return (
    <div
      className={cn(
        'group relative flex min-h-full w-full flex-col rounded-[30px] border bg-white p-6 shadow-[0_22px_54px_rgba(109,40,217,0.08)] transition-all duration-300 ease-out will-change-transform hover:-translate-y-2 hover:scale-[1.015] hover:shadow-[0_34px_80px_rgba(109,40,217,0.18)] motion-reduce:transform-none motion-reduce:transition-none',
        tilt === 'left' ? 'hover:-rotate-1' : 'hover:rotate-1',
        meta.highlight
          ? 'border-[#7c3aed] bg-[#f7f2ff] shadow-[0_28px_70px_rgba(109,40,217,0.16)]'
          : 'border-[#ebe2ff]'
      )}
    >
      {meta.badge && (
        <span className="absolute right-5 top-0 -translate-y-1/2 rounded-xl bg-[#7c3aed] px-4 py-2 text-xs font-bold uppercase tracking-normal text-white shadow-[0_14px_28px_rgba(109,40,217,0.22)]">
          {meta.badge}
        </span>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-2xl font-bold tracking-normal text-slate-950">{formatPlanName(plan)}</h3>
          <p className="mt-2 text-sm font-medium text-[#5a5d78]">Valid for {durationLabel}</p>
        </div>

        <SelectionCheck active={meta.highlight} />
      </div>

      <div className="mt-6">
        <span className="text-5xl font-bold tracking-normal text-slate-950">
          {formatCurrency(plan.amountPaise, plan.currency)}
        </span>
        <span className="ml-2 text-base font-semibold text-[#6b7280]">/ {durationLabel}</span>
      </div>

      <div className="mt-4 rounded-2xl border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-center text-sm font-bold text-[#8a4a0f]">
        {meta.summary}
      </div>

      <div className="mt-6 flex-1 space-y-3">
        {features.map((feature) => (
          <div key={feature} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#14b8a6] text-[#0f9f91]">
              <CheckIcon className="h-3.5 w-3.5" />
            </span>
            <p className="text-sm font-medium leading-6 text-slate-700">{feature}</p>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onSelect(plan)}
        className={cn(
          'mt-7 inline-flex w-full items-center justify-center rounded-2xl px-5 py-4 text-base font-semibold transition',
          meta.highlight
            ? 'bg-[#6d28d9] text-white shadow-[0_18px_38px_rgba(109,40,217,0.24)] hover:bg-[#5b21b6]'
            : 'border border-[#d8ccff] bg-white text-slate-950 hover:border-[#7c3aed] hover:text-[#6d28d9]'
        )}
      >
        Start with {durationLabel}
      </button>
    </div>
  )
}

function SelectionCheck({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
        active ? 'border-[#7c3aed] bg-[#7c3aed] text-white' : 'border-[#d8ccff] bg-white text-[#7c3aed]'
      )}
    >
      <CheckIcon className="h-4 w-4" />
    </span>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path d="M5 10.5l3.2 3.2L15 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  )
}

function FooterGroup({
  title,
  links,
}: {
  title: string
  links: Array<{ label: string; href: string }>
}) {
  return (
    <div>
      <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
      <div className="mt-5 space-y-3">
        {links.map((link) => (
          <a key={link.label} href={link.href} className="block text-base text-slate-600 transition hover:text-[#6d28d9]">
            {link.label}
          </a>
        ))}
      </div>
    </div>
  )
}

function FeatureIcon({ icon }: { icon: MoreFeature['icon'] }) {
  switch (icon) {
    case 'rankings':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-8 w-8">
          <path d="M8 21h8M12 17v4M7 4h10v3a5 5 0 01-10 0V4z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          <path d="M7 6H5a2 2 0 000 4h2M17 6h2a2 2 0 010 4h-2" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      )
    case 'support':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-8 w-8">
          <path d="M12 21s-6.5-4.35-8.6-8.27C1.66 9.76 3.2 6 6.94 6c2.03 0 3.15 1.13 4.06 2.36C11.91 7.13 13.03 6 15.06 6 18.8 6 20.34 9.76 20.6 12.73 18.5 16.65 12 21 12 21z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      )
    case 'communities':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-8 w-8">
          <path d="M16 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M9.5 11a4 4 0 100-8 4 4 0 000 8zM21 21v-2a4 4 0 00-3-3.87M14.5 3.13A4 4 0 0118 7a4 4 0 01-3.5 3.97" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      )
    case 'progress':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-8 w-8">
          <path d="M4 16l5-5 4 4 7-7M14 8h6v6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      )
  }
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

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
      <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  )
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
      <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  )
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}
