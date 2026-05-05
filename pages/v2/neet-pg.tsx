import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState, type HTMLAttributes, type ReactNode } from 'react'
import {
  apiFetch,
  CourseOptionsResponse,
  CourseSummary,
  extractAccessToken,
  extractRefreshToken,
  PaymentApiError,
  requestOtp,
  tokenStore,
  verifyOtp,
} from '@/lib/payment-client'

type AuthState = 'checking' | 'signed-out' | 'signed-in'
type CustomCourseOption = NonNullable<CourseOptionsResponse['customCourseOption']>
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
type HeroSlide = {
  title: string
  description: string
  image: string
  alt: string
}
type PricingOption = {
  duration: string
  price: string
  compareAt: string
  save: string
  badge?: string
  highlight?: boolean
}

const DOWNLOAD_HREF = '#'
const GOOGLE_PLAY_BADGE =
  'https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png'
const APP_STORE_BADGE =
  'https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg'

const NAV_ITEMS = [
  { label: 'Features', id: 'features' },
  { label: 'Why Virtual Library', id: 'why-virtual-library' },
  { label: '3 Steps', id: 'steps' },
  { label: 'Continue on Web', id: 'signup-form' },
]

const HERO_STATS = [
  { value: '2.5K+', label: 'App Downloads' },
  { value: '70%', label: 'Female Members' },
  { value: '1200+', label: 'Aspirants Study Daily' },
  { value: '625+', label: 'Focusing Right Now', highlight: true },
]

const HERO_SLIDES: HeroSlide[] = [
  {
    title: 'Struggling to stay consistent with your studies?',
    description:
      'Join a serious NEET-PG study system where 1,200+ aspirants show up daily, keep each other accountable, and stay in motion.',
    image: '/img/v2/Studying-rafiki.svg',
    alt: 'Student studying with the Virtual Library system',
  },
  {
    title: 'Need a cleaner way to protect your focus every day?',
    description:
      'Step into guided focus sessions, reduce distraction-heavy app use, and hold your study blocks with more intention.',
    image: '/img/v2/Time management-amico.svg',
    alt: 'Focus and time management illustration',
  },
  {
    title: 'Finishing topics, but still falling behind on revision?',
    description:
      'Track what you studied, come back on time with spaced reminders, and keep revision moving before topics go cold.',
    image: '/img/v2/Mobile note list-pana.svg',
    alt: 'Revision tracker and note management illustration',
  },
]

const FEATURE_SECTIONS: FeatureSection[] = [
  {
    title: 'Virtual Study Rooms',
    subtitle: '24-Hour Active Zoom Study Sessions.',
    description:
      'Study anytime with dedicated learners in our always-active Zoom sessions. Build consistency, stay accountable, and achieve more alongside like-minded aspirants.',
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

const SIGNUP_PRICING_OPTIONS: PricingOption[] = [
  {
    duration: '1 month',
    price: '₹699',
    compareAt: '₹999',
    save: 'Save 30%',
  },
  {
    duration: '6 months',
    price: '₹1,999',
    compareAt: '₹3,000',
    save: 'Save 33%',
    badge: 'Most Popular',
    highlight: true,
  },
  {
    duration: '12 months',
    price: '₹2,999',
    compareAt: '₹5,000',
    save: 'Save 40%',
  },
  {
    duration: '24 months',
    price: '₹3,999',
    compareAt: '₹7,000',
    save: 'Save 42%',
  },
]

const FLOW_STEPS = [
  {
    id: '1',
    title: 'Create your account',
    description:
      'Verify your number and choose your course on web so your account is ready for checkout.',
  },
  {
    id: '2',
    title: 'Choose your plan',
    description:
      'Pick the subscription duration that fits your prep window on the payment screen.',
  },
  {
    id: '3',
    title: 'Move into the app',
    description:
      'Download Virtual Library and start using study rooms, focus tools, rankings, and support.',
  },
]

const TESTIMONIAL = {
  image: '/img/Dr.Deepak_Aanjna.jpeg',
  name: 'Dr. Deepak Aanjna',
  quote:
    'Focus mode changed everything for me. I stopped wasting study blocks and finally built the consistency I needed for NEET-PG prep.',
  result: 'AIR 524',
  meta: 'NEET-PG Aspirant',
  pill: 'NEET PG',
}

export default function V2NeetPgPage() {
  const router = useRouter()
  const [authState, setAuthState] = useState<AuthState>('checking')
  const [heroSlideIndex, setHeroSlideIndex] = useState(0)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpRequested, setOtpRequested] = useState(false)
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpAction, setOtpAction] = useState<'send' | 'verify' | null>(null)
  const [authError, setAuthError] = useState('')
  const [profileError, setProfileError] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)
  const [accountName, setAccountName] = useState('')
  const [verifiedPhone, setVerifiedPhone] = useState('')
  const [courseOptions, setCourseOptions] = useState<CourseSummary[]>([])
  const [customCourseOption, setCustomCourseOption] = useState<CustomCourseOption | null>(null)
  const [selectedCourseChoice, setSelectedCourseChoice] = useState('')
  const [customCourseTitle, setCustomCourseTitle] = useState('')
  const [statusText, setStatusText] = useState('Checking your session...')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isCustomCourseSelected = selectedCourseChoice === customCourseOption?.key
  const formLocked = authState !== 'signed-in' || profileLoading

  const selectedCoursePreview = useMemo(() => {
    if (isCustomCourseSelected && customCourseTitle.trim()) {
      return {
        title: customCourseTitle.trim(),
        description: 'Custom course selection',
      }
    }

    const course = courseOptions.find((item) => item.courseId === selectedCourseChoice)

    return course
      ? {
          title: course.title,
          description: course.description || 'Course selected for checkout.',
        }
      : null
  }, [courseOptions, customCourseTitle, isCustomCourseSelected, selectedCourseChoice])

  useEffect(() => {
    void bootstrap()
  }, [])

  const activeHeroSlide = HERO_SLIDES[heroSlideIndex] || HERO_SLIDES[0]

  async function bootstrap() {
    if (!tokenStore.getAccessToken()) {
      setAuthState('signed-out')
      setStatusText('Verify your phone number to begin.')
      return
    }

    await hydrateSignedInState()
  }

  async function hydrateSignedInState(preferredPhone?: string) {
    setAuthState('checking')
    setStatusText('Loading your details...')
    setAuthError('')
    setProfileError('')

    try {
      const [meResult, courseResult] = await Promise.allSettled([
        apiFetch<any>('/me', {
          headers: {
            Accept: 'application/json',
          },
        }),
        apiFetch<CourseOptionsResponse>('/courses/options', {
          headers: {
            Accept: 'application/json',
          },
        }),
      ])

      const authFailure = [meResult, courseResult].find(
        (result) =>
          result.status === 'rejected' &&
          result.reason instanceof PaymentApiError &&
          result.reason.status === 401
      )

      if (authFailure) {
        tokenStore.clear()
        setAuthState('signed-out')
        setOtpRequested(false)
        setOtp('')
        setStatusText('Verify your phone number to continue.')
        return
      }

      if (courseResult.status !== 'fulfilled') {
        throw courseResult.reason
      }

      const coursePayload = courseResult.value
      const profilePayload = meResult.status === 'fulfilled' ? meResult.value : null
      const sortedCourses = [...(coursePayload.courses || [])].sort(
        (left, right) => (left.displayOrder || 0) - (right.displayOrder || 0)
      )
      const existingCourseId = extractCourseId(profilePayload)
      const existingCustomTitle = extractCourseTitle(profilePayload)
      const fallbackPhone = normalizePhoneDigits(extractPhone(profilePayload) || preferredPhone || phone)
      const preferredName = extractName(profilePayload)
      const nextCustomOption = coursePayload.customCourseOption || null
      const nextChoice = getInitialCourseChoice({
        courses: sortedCourses,
        customCourseOption: nextCustomOption,
        existingCourseId,
        existingCustomTitle,
      })

      setCourseOptions(sortedCourses)
      setCustomCourseOption(nextCustomOption)
      setSelectedCourseChoice(nextChoice)
      setCustomCourseTitle(existingCustomTitle)
      setVerifiedPhone(fallbackPhone)
      setAccountName((currentName) => preferredName || currentName)
      setPhone(fallbackPhone || preferredPhone || phone)
      setAuthState('signed-in')
      setStatusText('Account verified. Your checkout is ready.')
    } catch (error) {
      tokenStore.clear()
      setAuthState('signed-out')
      setOtpRequested(false)
      setOtp('')
      setAuthError('')
      setStatusText(getErrorMessage(error, 'Unable to prepare signup right now.'))
    }
  }

  async function handleRequestOtp() {
    setAuthError('')
    setOtpLoading(true)
    setOtpAction('send')

    try {
      await requestOtp(phone)
      setOtpRequested(true)
      setStatusText('OTP sent to your mobile number.')
    } catch (error) {
      setAuthError(getErrorMessage(error, 'Could not send OTP. Please try again.'))
    } finally {
      setOtpLoading(false)
      setOtpAction(null)
    }
  }

  async function handleVerifyOtp() {
    setAuthError('')
    setOtpLoading(true)
    setOtpAction('verify')

    try {
      const response = await verifyOtp(phone, otp)
      const accessToken = extractAccessToken(response)
      const refreshToken = extractRefreshToken(response)

      if (!accessToken) {
        throw new Error('Backend did not return an access token.')
      }

      tokenStore.setTokens({
        accessToken,
        refreshToken,
      })

      setVerifiedPhone(normalizePhoneDigits(phone))
      await hydrateSignedInState(normalizePhoneDigits(phone))
    } catch (error) {
      setAuthError(getErrorMessage(error, 'OTP verification failed. Please try again.'))
    } finally {
      setOtpLoading(false)
      setOtpAction(null)
    }
  }

  async function handleContinueToPayment() {
    const trimmedName = accountName.trim()
    const trimmedCustomCourse = customCourseTitle.trim()

    if (!trimmedName) {
      setProfileError('Enter your name to continue.')
      return
    }

    if (!selectedCourseChoice) {
      setProfileError('Choose your course to continue.')
      return
    }

    if (isCustomCourseSelected && !trimmedCustomCourse) {
      setProfileError('Enter your exam name to continue.')
      return
    }

    setProfileLoading(true)
    setProfileError('')
    setStatusText('Preparing payment...')

    try {
      const body = isCustomCourseSelected
        ? { name: trimmedName, selectedCourseTitle: trimmedCustomCourse }
        : { name: trimmedName, selectedCourseId: selectedCourseChoice }

      await apiFetch('/me/settings', {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      })

      const query: Record<string, string> = {
        source: 'v2-neet-pg',
      }

      if (!isCustomCourseSelected && selectedCourseChoice) {
        query.courseId = selectedCourseChoice
      }

      await router.push({
        pathname: '/payment',
        query,
      })
    } catch (error) {
      if (error instanceof PaymentApiError && error.status === 401) {
        tokenStore.clear()
        setAuthState('signed-out')
        setOtpRequested(false)
        setOtp('')
        setStatusText('Verify your phone number again to continue.')
        setProfileError('Your session expired. Please verify again.')
      } else {
        setProfileError(getErrorMessage(error, 'Could not save your details. Please try again.'))
      }
    } finally {
      setProfileLoading(false)
    }
  }

  function handleResetAccount() {
    tokenStore.clear()
    setAuthState('signed-out')
    setOtpRequested(false)
    setOtp('')
    setPhone('')
    setAccountName('')
    setVerifiedPhone('')
    setAuthError('')
    setProfileError('')
    setStatusText('Verify your phone number to continue.')
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
        <title>NEET-PG 2026 - Virtual Library</title>
        <meta
          name="description"
          content="A focused Virtual Library page for NEET-PG aspirants. Verify your number, choose your course, and continue to payment."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-white text-slate-900">
        <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
            <Link href="/" className="flex items-center">
              <img src="/img/logo.svg" alt="Virtual Library" className="h-12 w-auto sm:h-14" />
            </Link>

            <nav className="hidden items-center gap-8 lg:flex">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openSection(item.id)}
                  className="text-sm font-medium text-slate-700 transition hover:text-[#6d28d9]"
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="hidden items-center gap-3 md:flex">
              <button
                type="button"
                onClick={() => openSection('signup-form')}
                className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:border-[#6d28d9] hover:text-[#6d28d9]"
              >
                Continue on web
              </button>
              <button
                type="button"
                onClick={() => openSection('download-app')}
                className="rounded-2xl bg-[#6d28d9] px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(109,40,217,0.24)] transition hover:bg-[#5b21b6]"
              >
                Download App
              </button>
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((value) => !value)}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 p-2 text-slate-700 md:hidden"
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
            <div className="border-t border-slate-100 bg-white px-4 py-4 md:hidden">
              <div className="flex flex-col gap-3">
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openSection(item.id)}
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-left text-sm font-medium text-slate-700"
                  >
                    {item.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => openSection('download-app')}
                  className="rounded-2xl bg-[#6d28d9] px-4 py-3 text-left text-sm font-semibold text-white"
                >
                  Download App
                </button>
              </div>
            </div>
          )}
        </header>

        <main>
          <section className="flex flex-col lg:min-h-[calc(100vh-88px)]">
            <div className="relative overflow-hidden bg-[linear-gradient(114deg,#6825df_0%,#7432eb_46%,#9e83ff_100%)] pt-24 text-white sm:pt-28 lg:flex-1 lg:pt-24">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_28%),radial-gradient(circle_at_left_center,rgba(255,255,255,0.10),transparent_26%)]" />

              <div className="relative mx-auto flex h-full max-w-7xl flex-col px-4 sm:px-6">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => openSection('download-app')}
                    className="hidden items-center gap-3 rounded-full bg-white px-6 py-4 text-base font-semibold text-[#6d28d9] shadow-[0_18px_32px_rgba(32,12,78,0.16)] transition hover:bg-[#faf7ff] md:inline-flex"
                  >
                    <DownloadIcon className="h-5 w-5" />
                    Download App
                  </button>
                </div>

                <div className="grid items-center gap-8 pb-8 pt-6 lg:flex-1 lg:grid-cols-[0.92fr_0.88fr] lg:gap-10 lg:pb-8 lg:pt-4">
                  <div className="max-w-[34rem]">
                    <h1 className="max-w-[11ch] text-[3rem] font-bold leading-[0.92] tracking-[-0.06em] sm:text-[4rem] lg:max-w-[9ch] lg:text-[4.25rem]">
                      {activeHeroSlide.title}
                    </h1>

                    <p className="mt-5 max-w-[22rem] text-lg leading-[1.45] text-white/80 sm:text-[1.9rem] sm:leading-[1.22] lg:max-w-[15ch] lg:text-[1.55rem]">
                      {activeHeroSlide.description}
                    </p>

                    <button
                      type="button"
                      onClick={() => openSection('signup-form')}
                      className="mt-8 inline-flex min-w-[190px] items-center justify-center rounded-2xl bg-white px-8 py-4 text-lg font-semibold text-slate-950 shadow-[0_20px_38px_rgba(23,10,56,0.18)] transition hover:bg-slate-100"
                    >
                      Join Now
                    </button>
                  </div>

                  <div className="relative mx-auto w-full max-w-[22rem] sm:max-w-[26rem] lg:max-w-[28rem] xl:max-w-[30rem]">
                    <div className="relative aspect-square overflow-hidden rounded-full bg-white shadow-[0_30px_70px_rgba(28,10,74,0.24)]">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(109,40,217,0.08),transparent_35%)]" />
                      <img
                        key={activeHeroSlide.image}
                        src={activeHeroSlide.image}
                        alt={activeHeroSlide.alt}
                        className="relative z-10 mx-auto h-full w-full scale-[0.82] object-contain lg:scale-[0.84]"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 pb-5 lg:pb-6">
                  {HERO_SLIDES.map((slide, index) => (
                    <button
                      key={slide.title}
                      type="button"
                      onClick={() => setHeroSlideIndex(index)}
                      aria-label={`Show hero slide ${index + 1}`}
                      className={cn(
                        'h-3 rounded-full bg-white/70 transition-all',
                        index === heroSlideIndex ? 'w-8 bg-white' : 'w-3 hover:bg-white/90'
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-[#140d1f] py-6 text-white lg:py-5">
              <div className="mx-auto grid max-w-7xl gap-5 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
                {HERO_STATS.map((item, index) => (
                  <div
                    key={item.label}
                    className={cn(
                      'px-6 text-center sm:text-left',
                      index !== 0 && 'sm:border-l sm:border-white/10'
                    )}
                  >
                    <p
                      className={cn(
                        'text-4xl font-bold tracking-[-0.04em]',
                        item.highlight ? 'text-[#00d7a0]' : 'text-white'
                      )}
                    >
                      {item.value}
                    </p>
                    <p className="mt-1 text-sm uppercase tracking-[0.18em] text-white/48">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="signup" className="scroll-mt-24 bg-white py-16 sm:py-20">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <div className="mx-auto max-w-3xl text-center">
                <SectionPill>Continue On Web</SectionPill>
                <h2 className="mt-6 text-4xl font-bold tracking-[-0.04em] text-slate-950 md:text-6xl">
                  Create your access before you step into the app.
                </h2>
                <p className="mt-4 text-lg leading-8 text-[#5a5d78]">
                  Use web only for signup and checkout. Your actual day-to-day experience continues
                  inside Virtual Library with live study rooms, focus tools, rankings, and support.
                </p>
              </div>

              <div className="mt-12 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
                <div
                  id="download-app"
                  className="rounded-[32px] bg-[linear-gradient(145deg,#f7f0ff_0%,#efe6ff_100%)] p-8 shadow-[0_24px_60px_rgba(109,40,217,0.08)]"
                >
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#7c3aed]">
                    App-First Access
                  </p>
                  <h3 className="mt-4 text-3xl font-bold tracking-[-0.03em] text-slate-950 md:text-4xl">
                    Create your account on web. Choose the plan that fits your prep. Study inside
                    the app.
                  </h3>
                  <p className="mt-4 text-base leading-8 text-[#5a5d78]">
                    After signup, you will choose your subscription duration on the payment screen.
                    The most popular option right now is the <strong>6-month plan at ₹1,999</strong>,
                    but shorter and longer plans are available depending on how long you want access.
                  </p>

                  <div className="mt-8 space-y-3">
                    {SIGNUP_PRICING_OPTIONS.map((option) => (
                      <PricingSnapshotCard key={option.duration} option={option} />
                    ))}
                  </div>

                  <div className="mt-8 space-y-3">
                    <BenefitRow>Verify your phone number with OTP</BenefitRow>
                    <BenefitRow>Choose your course before checkout</BenefitRow>
                    <BenefitRow>Pick your final subscription duration on the payment screen</BenefitRow>
                  </div>

                  <p className="mt-6 text-sm leading-7 text-[#5a5d78]">
                    If you are unsure which plan to take, start with the prep window that matches
                    your exam timeline. You will see the full plan selector immediately after this
                    step.
                  </p>

                  <div className="mt-8">
                    <DownloadBadges />
                  </div>
                </div>

                <div
                  id="signup-form"
                  className="rounded-[32px] border border-[#ede2ff] bg-white p-6 shadow-[0_28px_72px_rgba(109,40,217,0.10)] md:p-8"
                >
                  <div className="mb-5">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#7c3aed]">
                      Signup
                    </p>
                    <h3 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-slate-950">
                      Continue on web
                    </h3>
                    <p className="mt-2 text-sm leading-7 text-[#5a5d78]">
                      Verify your number, select your course, and continue to checkout. You will
                      choose the subscription duration on the next screen.
                    </p>
                  </div>

                  {authState === 'signed-in' ? (
                    <div className="mb-4 rounded-3xl border border-green-200 bg-green-50 px-4 py-4">
                      <p className="text-sm font-medium text-green-900">
                        Verified: {verifiedPhone ? `+91 ${verifiedPhone}` : 'Session active'}
                      </p>
                      <button
                        type="button"
                        onClick={handleResetAccount}
                        className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-green-800"
                      >
                        Use another number
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="mb-4 flex gap-2">
                        <select
                          className="rounded-2xl border border-[#e6dbff] px-3 py-3 text-slate-700 focus:border-[#6d28d9] focus:outline-none"
                          disabled
                        >
                          <option>+91</option>
                        </select>

                        <div className="flex-1">
                          <input
                            type="text"
                            placeholder="Add your phone number"
                            value={phone}
                            onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
                            className="w-full rounded-2xl border border-[#e6dbff] px-4 py-3 text-slate-700 placeholder:text-slate-400 focus:border-[#6d28d9] focus:outline-none"
                            maxLength={10}
                            disabled={otpLoading || authState === 'checking'}
                          />
                        </div>
                      </div>

                      {otpRequested && (
                        <div className="mb-4">
                          <input
                            type="text"
                            placeholder="Enter OTP"
                            value={otp}
                            onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                            className="w-full rounded-2xl border border-[#e6dbff] px-4 py-3 text-slate-700 placeholder:text-slate-400 focus:border-[#6d28d9] focus:outline-none"
                            maxLength={6}
                            disabled={otpLoading}
                          />
                        </div>
                      )}

                      {authError && <InlineMessage>{authError}</InlineMessage>}

                      <div className="mb-5 grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={otpRequested ? handleVerifyOtp : handleRequestOtp}
                          disabled={
                            otpLoading ||
                            authState === 'checking' ||
                            phone.trim().length < 10 ||
                            (otpRequested && otp.trim().length < 4)
                          }
                          className="w-full rounded-2xl bg-[linear-gradient(90deg,#6d28d9,#8b5cf6)] py-3.5 text-base font-semibold text-white shadow-[0_18px_38px_rgba(109,40,217,0.20)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {otpRequested
                            ? otpLoading && otpAction === 'verify'
                              ? 'Verifying...'
                              : 'Verify OTP'
                            : otpLoading && otpAction === 'send'
                              ? 'Sending OTP...'
                              : 'Send OTP'}
                        </button>

                        {otpRequested && (
                          <button
                            type="button"
                            onClick={handleRequestOtp}
                            disabled={otpLoading}
                            className="w-full rounded-2xl border border-[#e6dbff] py-3.5 text-base font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {otpLoading && otpAction === 'send' ? 'Resending...' : 'Resend OTP'}
                          </button>
                        )}
                      </div>
                    </>
                  )}

                  <div className={cn(formLocked && 'pointer-events-none opacity-50')}>
                    <Field
                      label="Name"
                      value={accountName}
                      onChange={setAccountName}
                      placeholder="Your full name"
                      disabled={formLocked}
                    />

                    <div className="mt-4">
                      <label className="mb-2 block text-sm font-medium text-slate-700">Course</label>
                      <select
                        value={selectedCourseChoice}
                        onChange={(event) => setSelectedCourseChoice(event.target.value)}
                        disabled={formLocked}
                        className="w-full rounded-2xl border border-[#e6dbff] bg-white px-4 py-3 text-slate-700 focus:border-[#6d28d9] focus:outline-none"
                      >
                        {courseOptions.map((course) => (
                          <option key={course.courseId} value={course.courseId}>
                            {course.title}
                          </option>
                        ))}

                        {customCourseOption && (
                          <option value={customCourseOption.key}>{customCourseOption.title}</option>
                        )}
                      </select>

                      {selectedCoursePreview && (
                        <div className="mt-3 rounded-3xl bg-[#f7f2ff] px-4 py-4">
                          <p className="text-sm font-semibold text-slate-950">{selectedCoursePreview.title}</p>
                          <p className="mt-1 text-xs leading-6 text-[#5a5d78]">
                            {isCustomCourseSelected
                              ? 'Enter your exam name below.'
                              : selectedCoursePreview.description}
                          </p>
                        </div>
                      )}
                    </div>

                    {isCustomCourseSelected && (
                      <div className="mt-4">
                        <Field
                          label="Exam name"
                          value={customCourseTitle}
                          onChange={setCustomCourseTitle}
                          placeholder="For example, INI-CET"
                          disabled={formLocked}
                        />
                      </div>
                    )}
                  </div>

                  {profileError && <InlineMessage>{profileError}</InlineMessage>}

                  <button
                    type="button"
                    onClick={handleContinueToPayment}
                    disabled={formLocked}
                    className="mt-5 w-full rounded-2xl bg-[#0f0f15] py-4 text-base font-semibold text-white shadow-[0_18px_40px_rgba(15,15,21,0.18)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {profileLoading ? 'Preparing...' : 'Continue to Payment'}
                  </button>

                  <p className="mt-4 text-sm leading-7 text-[#5a5d78]">{statusText}</p>
                </div>
              </div>
            </div>
          </section>

          <section id="features" className="bg-white py-16 sm:py-20">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <div className="mx-auto max-w-3xl text-center">
                <SectionPill>Everything You Need</SectionPill>
                <h2 className="mt-6 text-4xl font-bold tracking-[-0.04em] text-slate-950 md:text-6xl">
                  Built for <span className="text-[#7c3aed]">Serious Aspirants</span>
                </h2>
                <p className="mt-4 text-lg leading-8 text-[#5a5d78]">
                  Every feature is designed to keep you consistent, focused, and ahead of the
                  competition.
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
                      <h3 className="text-4xl font-bold tracking-[-0.04em] text-slate-950 md:text-5xl">
                        {section.title}
                      </h3>
                      <p className="mt-5 text-2xl font-medium text-[#5a37a8]">{section.subtitle}</p>
                      <p className="mt-5 max-w-xl text-lg leading-8 text-[#5a5d78]">
                        {section.description}
                      </p>

                      <button
                        type="button"
                        onClick={() => openSection('signup-form')}
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
              <h2 className="text-4xl font-bold tracking-[-0.04em] text-slate-950">
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
                      <h3 className="text-3xl font-bold tracking-[-0.03em] text-[#7c3aed]">
                        {feature.title}
                      </h3>
                      <p className="mt-2 text-lg leading-7 text-[#5a5d78]">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="steps" className="bg-white py-16 sm:py-20">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <div className="mx-auto max-w-4xl text-center">
                <SectionPill>Simple Process</SectionPill>
                <h2 className="mt-6 text-4xl font-bold tracking-[-0.04em] text-slate-950 md:text-6xl">
                  Start Studying <span className="text-[#7c3aed]">In 3 Steps</span>
                </h2>
                <p className="mt-4 text-lg leading-8 text-[#5a5d78]">
                  No complicated setup. Join, study, and watch your rank climb.
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
                      <h3 className="mt-10 text-3xl font-bold tracking-[-0.03em] text-slate-950">
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
                    <h3 className="mt-5 text-2xl font-bold tracking-[-0.03em] text-slate-950">
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
                <h2 className="mt-6 text-5xl font-bold tracking-[-0.04em] md:text-7xl">
                  Why Virtual Library?
                </h2>
                <p className="mt-4 text-3xl font-semibold text-[#8f68ff] md:text-5xl">
                  Trusted By 12000+ Aspirants.
                </p>
              </div>

              <div className="mt-14 flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => openSection('signup-form')}
                  className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-full border border-white/50 text-white lg:flex"
                  aria-label="Open signup"
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
                        <h3 className="text-4xl font-bold tracking-[-0.03em]">{TESTIMONIAL.name}</h3>
                        <span className="text-3xl text-[#f59e0b]">★★★★★</span>
                      </div>
                      <p className="mt-5 text-2xl font-semibold italic leading-10 text-white/95">
                        “ {TESTIMONIAL.quote} ”
                      </p>
                      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <p className="text-4xl font-bold tracking-[-0.03em]">{TESTIMONIAL.result}</p>
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
                  onClick={() => openSection('download-app')}
                  className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-full border border-white/50 text-white lg:flex"
                  aria-label="Open app section"
                >
                  <ArrowRightIcon className="h-7 w-7" />
                </button>
              </div>
            </div>
          </section>

          <section className="bg-white py-16 sm:py-20">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <div className="rounded-[40px] bg-[linear-gradient(100deg,#6f2eff_0%,#7d3cff_48%,#9b7fff_100%)] px-6 py-12 text-center text-white shadow-[0_28px_72px_rgba(109,40,217,0.20)] sm:px-10">
                <div className="text-5xl">🚀</div>
                <h2 className="mt-6 text-4xl font-bold tracking-[-0.04em] md:text-6xl">
                  Your Rank Is Waiting. Start Today!
                </h2>
                <p className="mt-4 text-lg leading-8 text-white/72 md:text-2xl">
                  Join 12,000+ aspirants already studying smarter on Virtual Library.
                </p>

                <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => openSection('download-app')}
                    className="inline-flex min-w-[240px] items-center justify-center rounded-2xl bg-white px-8 py-4 text-xl font-semibold text-[#6d28d9] transition hover:bg-slate-100"
                  >
                    Download The App
                  </button>
                  <button
                    type="button"
                    onClick={() => openSection('signup-form')}
                    className="inline-flex min-w-[240px] items-center justify-center rounded-2xl border border-white/40 px-8 py-4 text-xl font-semibold text-white transition hover:bg-white/10"
                  >
                    Continue on web
                  </button>
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

        <button
          type="button"
          onClick={() => openSection('signup-form', 84)}
          className="fixed bottom-4 left-4 right-4 z-50 flex items-center justify-between rounded-2xl bg-[#0f0f15] px-5 py-4 text-white shadow-[0_24px_48px_rgba(15,15,21,0.22)] md:hidden"
        >
          <span className="text-lg font-semibold">Join Virtual Library</span>
          <ArrowRightIcon className="h-6 w-6" />
        </button>
      </div>
    </>
  )
}

function SectionPill({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-6 py-2 text-sm font-semibold uppercase tracking-[0.2em]',
        dark
          ? 'border-[#7c3aed] bg-[#241339] text-[#8f68ff]'
          : 'border-[#b78cff] bg-white text-[#7c3aed]'
      )}
    >
      ✦ {children}
    </span>
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

function PricingSnapshotCard({ option }: { option: PricingOption }) {
  return (
    <div
      className={cn(
        'rounded-[26px] border bg-white/88 px-4 py-4 shadow-[0_16px_34px_rgba(109,40,217,0.06)]',
        option.highlight ? 'border-[#8b5cf6] shadow-[0_20px_42px_rgba(109,40,217,0.12)]' : 'border-white/80'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold text-slate-950">{option.duration}</p>
            {option.badge && (
              <span className="rounded-full bg-[#7c3aed] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
                {option.badge}
              </span>
            )}
          </div>
          <span className="mt-3 inline-flex rounded-xl bg-[#dff5e8] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#1f8f56]">
            {option.save}
          </span>
        </div>

        <div className="text-right">
          <p className="text-sm font-medium text-slate-400 line-through">{option.compareAt}</p>
          <p className="mt-1 text-3xl font-bold tracking-[-0.04em] text-slate-950">{option.price}</p>
        </div>
      </div>
    </div>
  )
}

function BenefitRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/80 bg-white/70 px-4 py-4">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#7c3aed] text-sm font-bold text-white">
        ✓
      </span>
      <p className="text-sm font-medium leading-7 text-slate-700">{children}</p>
    </div>
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

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
  disabled,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
  disabled?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        disabled={disabled}
        className="w-full rounded-2xl border border-[#e6dbff] px-4 py-3 text-slate-700 placeholder:text-slate-400 focus:border-[#6d28d9] focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50"
      />
    </label>
  )
}

function InlineMessage({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {children}
    </div>
  )
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
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

function preventPlaceholderNavigation(event: React.MouseEvent<HTMLAnchorElement>) {
  event.preventDefault()
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof PaymentApiError) {
    return error.message || fallback
  }

  if (error instanceof Error) {
    return error.message || fallback
  }

  return fallback
}

function extractName(payload: any) {
  return findFirstString([
    payload?.name,
    payload?.data?.name,
    payload?.user?.name,
    payload?.data?.user?.name,
    payload?.profile?.name,
    payload?.data?.profile?.name,
  ])
}

function extractPhone(payload: any) {
  return findFirstString([
    payload?.phone,
    payload?.data?.phone,
    payload?.user?.phone,
    payload?.data?.user?.phone,
    payload?.mobile,
    payload?.data?.mobile,
    payload?.identifier,
    payload?.data?.identifier,
  ])
}

function extractCourseId(payload: any) {
  return findFirstString([
    payload?.selectedCourseId,
    payload?.data?.selectedCourseId,
    payload?.selectedCourse?.courseId,
    payload?.data?.selectedCourse?.courseId,
    payload?.course?.courseId,
    payload?.data?.course?.courseId,
    payload?.courseId,
    payload?.data?.courseId,
  ])
}

function extractCourseTitle(payload: any) {
  return findFirstString([
    payload?.selectedCourseTitle,
    payload?.data?.selectedCourseTitle,
    payload?.selectedCourse?.title,
    payload?.data?.selectedCourse?.title,
  ])
}

function findFirstString(values: unknown[]) {
  const match = values.find((value) => typeof value === 'string' && value.trim())
  return typeof match === 'string' ? match.trim() : ''
}

function normalizePhoneDigits(input: string) {
  const digits = String(input || '').replace(/\D/g, '')

  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2)
  }

  if (digits.length > 10) {
    return digits.slice(-10)
  }

  return digits
}

function getInitialCourseChoice({
  courses,
  customCourseOption,
  existingCourseId,
  existingCustomTitle,
}: {
  courses: CourseSummary[]
  customCourseOption: CustomCourseOption | null
  existingCourseId: string
  existingCustomTitle: string
}) {
  if (existingCourseId && courses.some((course) => course.courseId === existingCourseId)) {
    return existingCourseId
  }

  if (existingCustomTitle && customCourseOption) {
    return customCourseOption.key
  }

  const neetPgCourse =
    courses.find((course) => /neet/i.test(`${course.title} ${course.slug}`) && /pg/i.test(`${course.title} ${course.slug}`)) ||
    courses.find((course) => /neet/i.test(`${course.title} ${course.slug}`))

  if (neetPgCourse) {
    return neetPgCourse.courseId
  }

  if (courses[0]) {
    return courses[0].courseId
  }

  return customCourseOption?.key || ''
}
