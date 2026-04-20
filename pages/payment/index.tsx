import Head from 'next/head'
import Script from 'next/script'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  apiFetch,
  BillingOrderResponse,
  BillingPlan,
  BillingPlansResponse,
  BillingVerifyResponse,
  buildReturnUrl,
  CourseOptionsResponse,
  CourseSummary,
  extractAccessToken,
  extractRefreshToken,
  formatCurrency,
  hasGrantedCourseAccess,
  PaymentApiError,
  postMobileEvent,
  requestOtp,
  tokenStore,
  verifyOtp,
} from '@/lib/payment-client'

type ScreenState = 'booting' | 'otp' | 'course' | 'ready' | 'processing' | 'pending' | 'success' | 'failed' | 'error'

type ResultState = {
  title: string
  message: string
  tone: 'success' | 'warning' | 'danger'
  returnUrl?: string
}

export default function PaymentPage() {
  const router = useRouter()
  const pendingPollRef = useRef<number | null>(null)
  const deepLinkTimeoutRef = useRef<number | null>(null)

  const [screen, setScreen] = useState<ScreenState>('booting')
  const [plans, setPlans] = useState<BillingPlan[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [pageError, setPageError] = useState('')
  const [authError, setAuthError] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpRequested, setOtpRequested] = useState(false)
  const [otpLoading, setOtpLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [razorpayReady, setRazorpayReady] = useState(false)
  const [result, setResult] = useState<ResultState | null>(null)
  const [statusNote, setStatusNote] = useState('Loading payment options...')
  const [selectedCourse, setSelectedCourse] = useState<CourseSummary | null>(null)
  const [courseOptions, setCourseOptions] = useState<CourseSummary[]>([])
  const [customCourseOption, setCustomCourseOption] = useState<{
    key: string
    title: string
    requiresCustomTitle: boolean
  } | null>(null)
  const [selectedCourseChoice, setSelectedCourseChoice] = useState('')
  const [customCourseTitle, setCustomCourseTitle] = useState('')
  const [courseLoading, setCourseLoading] = useState(false)
  const [courseError, setCourseError] = useState('')

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.planId === selectedPlanId) || null,
    [plans, selectedPlanId]
  )

  const groupedPlans = useMemo(() => {
    const groups = new Map<string, { course: BillingPlan['course']; plans: BillingPlan[] }>()

    plans.forEach((plan) => {
      const key = plan.course.courseId

      if (!groups.has(key)) {
        groups.set(key, { course: plan.course, plans: [] })
      }

      groups.get(key)?.plans.push(plan)
    })

    return Array.from(groups.values()).sort((left, right) => {
      return (left.course.displayOrder || 0) - (right.course.displayOrder || 0)
    })
  }, [plans])

  useEffect(() => {
    if (!router.isReady) {
      return
    }

    void bootstrap()
  }, [router.isReady])

  useEffect(() => {
    return () => {
      if (pendingPollRef.current) {
        window.clearInterval(pendingPollRef.current)
      }

      if (deepLinkTimeoutRef.current) {
        window.clearTimeout(deepLinkTimeoutRef.current)
      }
    }
  }, [])

  function ensureAuthorization(message: string) {
    if (tokenStore.getAccessToken()) {
      return true
    }

    setScreen('otp')
    setAuthError(message)
    setPageError('')
    setStatusNote('Sign in to continue with payment.')
    postMobileEvent('AUTH_REQUIRED')
    return false
  }

  async function bootstrap() {
    setPageError('')
    setAuthError('')
    setCourseError('')
    setStatusNote('Loading payment options...')
    setResult(null)

    if (!ensureAuthorization('Log in with your phone number before we load plans.')) {
      return
    }

    await loadPlans()
  }

  async function loadPlans() {
    if (!ensureAuthorization('Log in with your phone number before we load plans.')) {
      return
    }

    try {
      setScreen('booting')
      const planIdFromQuery = getQueryParam(router.query.planId)
      const data = await apiFetch<BillingPlansResponse>('/billing/plans', {
        headers: {
          Accept: 'application/json',
        },
      })

      if (data.requiresCourseSelection) {
        setPlans([])
        setSelectedPlanId('')
        setSelectedCourse(null)
        await loadCourseOptions(data.message)
        return
      }

      const availablePlans = data?.plans || []

      if (!availablePlans.length) {
        setScreen('error')
        setPageError('No plans are available right now. Please try again shortly.')
        return
      }

      setSelectedCourse(data.selectedCourse || availablePlans[0]?.course || null)
      setPlans(availablePlans)
      const preferredPlan = availablePlans.find((plan) => plan.planId === planIdFromQuery)
      const nextSelectedPlan = preferredPlan?.planId || availablePlans[0].planId
      setSelectedPlanId(nextSelectedPlan)
      setScreen('ready')
      setAuthError('')
      setCourseError('')
      setStatusNote('Choose a plan and continue to payment.')
      postMobileEvent('CHECKOUT_READY', {
        planCount: availablePlans.length,
      })
    } catch (error) {
      if (error instanceof PaymentApiError && error.status === 401) {
        tokenStore.clear()
        setScreen('otp')
        setAuthError('Your session is missing or expired. Sign in with your phone number to continue.')
        postMobileEvent('AUTH_REQUIRED')
        return
      }

      setScreen('error')
      setPageError(getErrorMessage(error, 'Unable to load plans. Please try again.'))
    }
  }

  async function loadCourseOptions(message?: string) {
    try {
      setCourseLoading(true)
      const options = await apiFetch<CourseOptionsResponse>('/courses/options', {
        headers: {
          Accept: 'application/json',
        },
      })

      const preferredCourseId = getQueryParam(router.query.courseId)
      const normalizedCourses = [...(options.courses || [])].sort(
        (left, right) => (left.displayOrder || 0) - (right.displayOrder || 0)
      )
      const hasPreferredCourse = preferredCourseId
        ? normalizedCourses.some((course) => course.courseId === preferredCourseId)
        : false

      setCourseOptions(normalizedCourses)
      setCustomCourseOption(options.customCourseOption || null)
      setSelectedCourseChoice((currentChoice) => {
        const hasCurrentChoice =
          normalizedCourses.some((course) => course.courseId === currentChoice) ||
          currentChoice === options.customCourseOption?.key

        if (currentChoice && hasCurrentChoice) {
          return currentChoice
        }

        if (hasPreferredCourse && preferredCourseId) {
          return preferredCourseId
        }

        return normalizedCourses[0]?.courseId || options.customCourseOption?.key || ''
      })
      setScreen('course')
      setPageError('')
      setCourseError('')
      setStatusNote(message || 'Choose a course to continue.')
    } catch (error) {
      setScreen('error')
      setPageError(getErrorMessage(error, 'Unable to load course options. Please try again.'))
    } finally {
      setCourseLoading(false)
    }
  }

  async function handleRequestOtp() {
    setOtpLoading(true)
    setAuthError('')

    try {
      await requestOtp(phone)
      setOtpRequested(true)
      setStatusNote('We sent an OTP to your phone number.')
    } catch (error) {
      setAuthError(getErrorMessage(error, 'Could not send OTP. Please try again.'))
    } finally {
      setOtpLoading(false)
    }
  }

  async function handleVerifyOtp() {
    setOtpLoading(true)
    setAuthError('')

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
      postMobileEvent('AUTH_SUCCESS')
      await loadPlans()
    } catch (error) {
      setAuthError(getErrorMessage(error, 'OTP verification failed. Please try again.'))
    } finally {
      setOtpLoading(false)
    }
  }

  async function handleSaveCourseSelection() {
    if (!ensureAuthorization('Log in with your phone number before choosing a course.')) {
      return
    }

    if (!selectedCourseChoice) {
      setCourseError('Choose a course to continue.')
      return
    }

    if (selectedCourseChoice === customCourseOption?.key) {
      if (!customCourseTitle.trim()) {
        setCourseError('Enter your exam name to continue.')
        return
      }
    }

    setCourseLoading(true)
    setCourseError('')
    setStatusNote('Saving your course selection...')

    try {
      const body =
        selectedCourseChoice === customCourseOption?.key
          ? { selectedCourseTitle: customCourseTitle.trim() }
          : { selectedCourseId: selectedCourseChoice }

      await apiFetch('/me/settings', {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      })

      await loadPlans()
    } catch (error) {
      setCourseError(getErrorMessage(error, 'Unable to save your course. Please try again.'))
    } finally {
      setCourseLoading(false)
    }
  }

  async function handlePayNow() {
    if (!ensureAuthorization('Log in with your phone number before starting payment.')) {
      return
    }

    if (!selectedPlan) {
      setPageError('Select a plan before continuing.')
      return
    }

    if (!razorpayReady || typeof window === 'undefined' || !window.Razorpay) {
      setPageError('Payment gateway is still loading. Please try again in a moment.')
      return
    }

    setCheckoutLoading(true)
    setPageError('')
    setStatusNote('Creating your order...')

    try {
      const order = await apiFetch<BillingOrderResponse>('/billing/orders', {
        method: 'POST',
        body: JSON.stringify({ planId: selectedPlan.planId }),
      })

      openRazorpayCheckout(order)
    } catch (error) {
      if (error instanceof PaymentApiError && error.status === 401) {
        tokenStore.clear()
        setScreen('otp')
        setAuthError('Your session expired. Sign in again to continue.')
        setCheckoutLoading(false)
        return
      }

      setPageError(getErrorMessage(error, 'Could not create the payment order. Please try again.'))
      setCheckoutLoading(false)
      setStatusNote('Order creation failed.')
    }
  }

  function openRazorpayCheckout(order: BillingOrderResponse) {
    const checkout = new window.Razorpay({
      key: order.keyId || order.razorpay.keyId,
      order_id: order.orderId || order.razorpay.orderId,
      amount: order.amount || order.razorpay.amountPaise,
      currency: order.currency || order.razorpay.currency,
      name: 'Virtual Library',
      description: `${order.course.title} • ${order.plan.name}`,
      prefill: {
        name: order.user?.name,
        email: order.user?.email,
        contact: order.user?.phoneE164,
      },
      theme: {
        color: '#171717',
      },
      handler: async (response: RazorpaySuccessResponse) => {
        await handleVerifyPayment(order, response)
      },
      modal: {
        ondismiss: () => {
          setCheckoutLoading(false)
          setStatusNote('Checkout dismissed. You can retry whenever you are ready.')
          postMobileEvent('PAYMENT_CANCELLED', {
            planId: order.plan.planId,
            orderId: order.order.id,
          })
        },
      },
    })

    checkout.on('payment.failed', (response: any) => {
      setCheckoutLoading(false)
      setScreen('failed')
      setResult({
        title: 'Payment failed',
        message: response?.error?.description || 'Razorpay could not complete the payment.',
        tone: 'danger',
      })
      postMobileEvent('PAYMENT_FAILED', {
        reason: response?.error?.description,
      })
    })

    setStatusNote('Opening secure checkout...')
    checkout.open()
  }

  async function handleVerifyPayment(order: BillingOrderResponse, response: RazorpaySuccessResponse) {
    setScreen('processing')
    setStatusNote('Verifying your payment...')

    try {
      const verification = await apiFetch<BillingVerifyResponse>('/billing/verify', {
        method: 'POST',
        body: JSON.stringify({
          planId: order.plan.planId,
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        }),
      })

      if (verification.status === 'COMPLETED') {
        await Promise.allSettled([
          apiFetch('/me/courses'),
          apiFetch('/me'),
        ])

        setCheckoutLoading(false)
        setScreen('success')
        setResult({
          title: 'Access unlocked',
          message: `Payment confirmed for ${order.course.title}. You can continue in the app or stay on this page.`,
          tone: 'success',
          returnUrl: verification.returnUrl,
        })
        setStatusNote('Payment completed successfully.')
        postMobileEvent('PAYMENT_SUCCESS', {
          planId: order.plan.planId,
          courseId: order.course.courseId,
          paymentStatus: verification.paymentStatus,
        })
        scheduleReturnToApp(verification.returnUrl, 'success')
        return
      }

      if (verification.status === 'PENDING') {
        setCheckoutLoading(false)
        setScreen('pending')
        setResult({
          title: 'Payment is being processed',
          message: 'We received your payment response, but final confirmation is still in progress.',
          tone: 'warning',
          returnUrl: verification.returnUrl,
        })
        setStatusNote('Waiting for final confirmation...')
        postMobileEvent('PAYMENT_PENDING', {
          planId: order.plan.planId,
          courseId: order.course.courseId,
          paymentStatus: verification.paymentStatus,
        })
        startPendingAccessPoll({
          courseId: order.course.courseId,
          slug: order.course.slug,
          returnUrl: verification.returnUrl,
        })
        return
      }

      setCheckoutLoading(false)
      setScreen('failed')
      setResult({
        title: 'Payment verification failed',
        message: verification.message || 'We could not verify the payment with Razorpay.',
        tone: 'danger',
        returnUrl: verification.returnUrl,
      })
      setStatusNote('Verification failed.')
      postMobileEvent('PAYMENT_FAILED', {
        planId: order.plan.planId,
        courseId: order.course.courseId,
        paymentStatus: verification.paymentStatus,
      })
      scheduleReturnToApp(verification.returnUrl, 'failed')
    } catch (error) {
      setCheckoutLoading(false)
      setScreen('failed')
      setResult({
        title: 'Verification failed',
        message: getErrorMessage(error, 'We could not confirm the payment. Please try again.'),
        tone: 'danger',
      })
      setStatusNote('Verification failed.')
    }
  }

  function startPendingAccessPoll(context: { courseId?: string; slug?: string; returnUrl?: string }) {
    if (pendingPollRef.current) {
      window.clearInterval(pendingPollRef.current)
    }

    let attempts = 0
    pendingPollRef.current = window.setInterval(async () => {
      attempts += 1

      try {
        const access = await apiFetch('/me/courses')

        if (hasGrantedCourseAccess(access, context)) {
          if (pendingPollRef.current) {
            window.clearInterval(pendingPollRef.current)
            pendingPollRef.current = null
          }

          setScreen('success')
          setResult({
            title: 'Access unlocked',
            message: 'Your course access is active now.',
            tone: 'success',
            returnUrl: context.returnUrl,
          })
          setStatusNote('Payment completed successfully.')
          postMobileEvent('PAYMENT_SUCCESS', {
            courseId: context.courseId,
          })
          scheduleReturnToApp(context.returnUrl, 'success')
          return
        }
      } catch {
        // Polling is best-effort; keep the user on the pending state.
      }

      if (attempts >= 8 && pendingPollRef.current) {
        window.clearInterval(pendingPollRef.current)
        pendingPollRef.current = null
      }
    }, 3000)
  }

  function scheduleReturnToApp(returnUrl: string | undefined, status: 'success' | 'failed') {
    if (!returnUrl) {
      return
    }

    if (deepLinkTimeoutRef.current) {
      window.clearTimeout(deepLinkTimeoutRef.current)
    }

    deepLinkTimeoutRef.current = window.setTimeout(() => {
      window.location.href = buildReturnUrl(returnUrl, status)
    }, 1200)
  }

  function handleReturnToApp(status: 'success' | 'pending' | 'failed') {
    if (!result?.returnUrl) {
      return
    }

    window.location.href = buildReturnUrl(result.returnUrl, status)
  }

  const statusTone = result?.tone || 'warning'
  const isCustomCourseSelected = selectedCourseChoice === customCourseOption?.key
  const selectedCoursePreview =
    selectedCourse ||
    courseOptions.find((course) => course.courseId === selectedCourseChoice) ||
    (isCustomCourseSelected && customCourseTitle.trim()
      ? {
          courseId: '',
          slug: 'custom-course',
          title: customCourseTitle.trim(),
          description: 'Custom exam selection',
          displayOrder: 9999,
          kind: 'CUSTOM',
        }
      : null)

  return (
    <>
      <Head>
        <title>Payment - Virtual Library</title>
        <meta name="description" content="Secure checkout for Virtual Library memberships." />
        <meta name="robots" content="noindex, nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onLoad={() => setRazorpayReady(true)}
        onError={() => setPageError('Could not load Razorpay Checkout. Please refresh and try again.')}
      />

      <div className="min-h-screen bg-[#f9f9fb] text-slate-900">
        <div
          className="relative overflow-hidden bg-[#6b21a8]"
          style={{
            backgroundImage: "url('/img/banner-bg.jpg')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#6b21a8]/95 via-[#6b21a8]/90 to-[#6b21a8]/80" />
          <div className="relative z-10 mx-auto max-w-6xl px-4 pb-28 pt-8 sm:px-6 lg:px-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#d3b8ff]">Virtual Library</p>
                <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  Secure membership checkout
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-200 sm:text-base">
                  This payment flow lives inside the app and on the web, but it should still feel like the same Virtual
                  Library product. Complete payment here and unlock access after backend verification.
                </p>
              </div>

              <div className="hidden rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-right shadow-sm backdrop-blur sm:block">
                <p className="text-xs uppercase tracking-[0.2em] text-[#d3b8ff]">Status</p>
                <p className="mt-1 text-sm font-medium text-white">{statusNote}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative mx-auto -mt-16 max-w-6xl px-4 pb-10 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.10)] sm:p-8">
              {screen === 'booting' && (
                <LoadingPanel label="Preparing your checkout..." />
              )}

              {screen === 'otp' && (
                <div className="max-w-lg">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#6b21a8]">Sign in to continue</p>
                  <h2 className="mt-3 text-2xl font-semibold text-slate-950">Verify your phone number</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    We need an access token before calling the billing APIs. Enter your mobile number and the OTP from
                    the backend.
                  </p>

                  <div className="mt-8 space-y-4">
                    <div>
                      <label htmlFor="phone" className="mb-2 block text-sm font-medium text-slate-700">
                        Phone number
                      </label>
                      <div className="flex items-center rounded-2xl border border-slate-200 bg-[#f9f9fb] px-4">
                        <span className="mr-3 text-sm font-medium text-slate-500">+91</span>
                        <input
                          id="phone"
                          type="tel"
                          inputMode="numeric"
                          autoComplete="tel-national"
                          placeholder="9876543210"
                          value={phone}
                          onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
                          className="w-full border-0 bg-transparent px-0 py-4 text-base text-slate-900 placeholder:text-slate-400 focus:ring-0"
                          disabled={otpLoading}
                        />
                      </div>
                    </div>

                    {otpRequested && (
                      <div>
                        <label htmlFor="otp" className="mb-2 block text-sm font-medium text-slate-700">
                          OTP
                        </label>
                        <input
                          id="otp"
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder="Enter the 6-digit OTP"
                          value={otp}
                          onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="block w-full rounded-2xl border border-slate-200 bg-[#f9f9fb] px-4 py-4 text-base text-slate-900 placeholder:text-slate-400 focus:border-[#a78bfa] focus:ring-0"
                          disabled={otpLoading}
                        />
                      </div>
                    )}

                    {authError && (
                      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {authError}
                      </div>
                    )}

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={handleRequestOtp}
                        disabled={otpLoading}
                        className="inline-flex items-center justify-center rounded-full bg-black px-6 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {otpLoading && !otpRequested ? 'Sending OTP...' : 'Send OTP'}
                      </button>

                      {otpRequested && (
                        <button
                          type="button"
                          onClick={handleVerifyOtp}
                          disabled={otpLoading || otp.length < 4}
                          className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-900 transition hover:border-[#a78bfa] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {otpLoading ? 'Verifying...' : 'Verify and continue'}
                        </button>
                      )}
                    </div>

                    <p className="text-xs leading-5 text-slate-500">
                      If this page was opened from the app and the handoff expired, reopen checkout from the app instead
                      of refreshing repeatedly.
                    </p>
                  </div>
                </div>
              )}

              {screen === 'course' && (
                <div className="space-y-6">
                  <div className="max-w-2xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#6b21a8]">Choose a course</p>
                    <h2 className="mt-3 text-2xl font-semibold text-slate-950">Choose a course to continue</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      Your billing plans depend on the exam you are preparing for. Pick a catalog course or add a custom
                      exam title, then we&apos;ll load the right plans for you.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {courseOptions.map((course) => {
                      const isActive = selectedCourseChoice === course.courseId

                      return (
                        <button
                          key={course.courseId}
                          type="button"
                          onClick={() => setSelectedCourseChoice(course.courseId)}
                          className={`rounded-[1.75rem] border px-5 py-5 text-left transition ${
                            isActive
                              ? 'border-[#6b21a8] bg-[#6b21a8] text-white shadow-[0_18px_40px_rgba(107,33,168,0.25)]'
                              : 'border-slate-200 bg-[#f9f9fb] text-slate-900 hover:border-[#d8b4fe]'
                          }`}
                        >
                          <p className={`text-xs font-semibold uppercase tracking-[0.24em] ${isActive ? 'text-[#d3b8ff]' : 'text-slate-500'}`}>
                            {course.kind || 'CATALOG'}
                          </p>
                          <p className="mt-3 text-xl font-semibold">{course.title}</p>
                          <p className={`mt-2 text-sm leading-6 ${isActive ? 'text-slate-200' : 'text-slate-600'}`}>
                            {course.description || 'Load plans for this exam track.'}
                          </p>
                        </button>
                      )
                    })}

                    {customCourseOption && (
                      <button
                        type="button"
                        onClick={() => setSelectedCourseChoice(customCourseOption.key)}
                        className={`rounded-[1.75rem] border px-5 py-5 text-left transition ${
                          isCustomCourseSelected
                            ? 'border-[#6b21a8] bg-[#6b21a8] text-white shadow-[0_18px_40px_rgba(107,33,168,0.25)]'
                            : 'border-slate-200 bg-[#f9f9fb] text-slate-900 hover:border-[#d8b4fe]'
                        }`}
                      >
                        <p className={`text-xs font-semibold uppercase tracking-[0.24em] ${isCustomCourseSelected ? 'text-[#d3b8ff]' : 'text-slate-500'}`}>
                          Custom
                        </p>
                        <p className="mt-3 text-xl font-semibold">{customCourseOption.title}</p>
                        <p className={`mt-2 text-sm leading-6 ${isCustomCourseSelected ? 'text-slate-200' : 'text-slate-600'}`}>
                          Create a private exam track for checkout if your course is not listed.
                        </p>
                      </button>
                    )}
                  </div>

                  {isCustomCourseSelected && (
                    <div className="max-w-xl">
                      <label htmlFor="customCourseTitle" className="mb-2 block text-sm font-medium text-slate-700">
                        Exam name
                      </label>
                      <input
                        id="customCourseTitle"
                        type="text"
                        placeholder="For example, AFCAT"
                        value={customCourseTitle}
                        onChange={(event) => setCustomCourseTitle(event.target.value)}
                        className="block w-full rounded-2xl border border-slate-200 bg-[#f9f9fb] px-4 py-4 text-base text-slate-900 placeholder:text-slate-400 focus:border-[#a78bfa] focus:ring-0"
                        disabled={courseLoading}
                      />
                    </div>
                  )}

                  {courseError && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {courseError}
                    </div>
                  )}

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={handleSaveCourseSelection}
                      disabled={courseLoading}
                      className="inline-flex items-center justify-center rounded-full bg-black px-6 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {courseLoading ? 'Saving course...' : 'Continue to plans'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        tokenStore.clear()
                        setOtpRequested(false)
                        setOtp('')
                        setScreen('otp')
                        setAuthError('Sign in again to choose a different account.')
                      }}
                      className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-900 transition hover:border-[#a78bfa]"
                    >
                      Use another account
                    </button>
                  </div>
                </div>
              )}

              {(screen === 'ready' || screen === 'processing' || screen === 'pending' || screen === 'success' || screen === 'failed' || screen === 'error') && (
                <div className="space-y-6">
                  {groupedPlans.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#6b21a8]">Plans</p>
                          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Choose your access plan</h2>
                        </div>
                        <div className="rounded-full border border-[#e9d5ff] bg-[#faf5ff] px-4 py-2 text-xs font-medium text-[#6b21a8]">
                          Backend verified
                        </div>
                      </div>

                      <div className="mt-6 space-y-5">
                        {groupedPlans.map((group) => (
                          <div key={group.course.courseId}>
                            <div className="mb-3">
                              <h3 className="text-lg font-semibold text-slate-900">{group.course.title}</h3>
                              {group.course.description && (
                                <p className="mt-1 text-sm text-slate-500">{group.course.description}</p>
                              )}
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                              {group.plans.map((plan) => {
                                const isActive = selectedPlanId === plan.planId

                                return (
                                  <button
                                    key={plan.planId}
                                    type="button"
                                    onClick={() => setSelectedPlanId(plan.planId)}
                                    className={`rounded-[1.75rem] border px-5 py-5 text-left transition ${
                                      isActive
                                        ? 'border-[#6b21a8] bg-[#6b21a8] text-white shadow-[0_18px_40px_rgba(107,33,168,0.25)]'
                                        : 'border-slate-200 bg-[#f9f9fb] text-slate-900 hover:border-[#d8b4fe]'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className={`text-xs font-semibold uppercase tracking-[0.24em] ${isActive ? 'text-[#d3b8ff]' : 'text-slate-500'}`}>
                                          {plan.code}
                                        </p>
                                        <p className="mt-3 text-2xl font-semibold">{plan.name}</p>
                                      </div>
                                      <div className={`rounded-full px-3 py-1 text-xs font-medium ${isActive ? 'bg-white/10 text-white' : 'bg-white text-slate-600'}`}>
                                        {plan.durationMonths} month{plan.durationMonths > 1 ? 's' : ''}
                                      </div>
                                    </div>
                                    <p className={`mt-5 text-lg font-semibold ${isActive ? 'text-white' : 'text-slate-900'}`}>
                                      {formatCurrency(plan.amountPaise, plan.currency)}
                                    </p>
                                    <p className={`mt-2 text-sm leading-6 ${isActive ? 'text-slate-200' : 'text-slate-600'}`}>
                                      {plan.description || 'Instant access after payment verification.'}
                                    </p>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {pageError && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {pageError}
                    </div>
                  )}

                  {screen === 'error' && pageError && (
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void bootstrap()}
                        className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
                      >
                        Retry
                      </button>
                      <a
                        href="/payment/error?code=HANDOFF_INVALID"
                        className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-900 transition hover:border-slate-400"
                      >
                        Open help
                      </a>
                    </div>
                  )}
                </div>
              )}
            </section>

            <aside className="rounded-[2rem] border border-[#2f2047] bg-[#0e0e0e] p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.18)] sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#d3b8ff]">Summary</p>

              {selectedPlan ? (
                <>
                  <div className="mt-5 rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-5">
                    <p className="text-sm text-slate-300">{selectedPlan.course.title}</p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">{selectedPlan.name}</h3>
                    <p className="mt-3 text-3xl font-semibold">{formatCurrency(selectedPlan.amountPaise, selectedPlan.currency)}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      {selectedPlan.description || `Access for ${selectedPlan.durationMonths} month${selectedPlan.durationMonths > 1 ? 's' : ''}.`}
                    </p>
                  </div>

                  <div className="mt-6 rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                    <ul className="space-y-3 text-sm text-slate-300">
                      <li>Razorpay Checkout opens directly from this page.</li>
                      <li>Access is granted only after backend verification succeeds.</li>
                      <li>Webhooks reconcile missed callbacks in the background.</li>
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={handlePayNow}
                    disabled={screen !== 'ready' || checkoutLoading}
                    className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-white px-6 py-4 text-base font-semibold text-[#6b21a8] transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {checkoutLoading ? 'Preparing checkout...' : 'Pay now'}
                  </button>

                  {!razorpayReady && (
                    <p className="mt-3 text-xs text-[#d3b8ff]">Secure checkout script is still loading.</p>
                  )}
                </>
              ) : selectedCoursePreview ? (
                <>
                  <div className="mt-5 rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-5">
                    <p className="text-sm text-slate-300">Selected course</p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">{selectedCoursePreview.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      {selectedCoursePreview.description || 'Save this course choice to load the available plans.'}
                    </p>
                  </div>

                  <div className="mt-6 rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                    <ul className="space-y-3 text-sm text-slate-300">
                      <li>Course selection decides which billing plans are available.</li>
                      <li>If your exam is not listed, use the custom option to create one.</li>
                      <li>Once saved, this page will reload the correct checkout plans.</li>
                    </ul>
                  </div>
                </>
              ) : (
                <div className="mt-5 rounded-[1.75rem] border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
                  {screen === 'course' ? 'Choose a course to unlock the right plans.' : 'Select a plan to continue.'}
                </div>
              )}

              {result && (
                <div
                  className={`mt-6 rounded-[1.75rem] border p-5 ${
                    statusTone === 'success'
                      ? 'border-emerald-400/30 bg-emerald-400/10'
                      : statusTone === 'warning'
                        ? 'border-amber-300/30 bg-amber-300/10'
                        : 'border-rose-400/30 bg-rose-400/10'
                  }`}
                >
                  <h4 className="text-lg font-semibold text-white">{result.title}</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-200">{result.message}</p>

                  {result.returnUrl && (
                    <button
                      type="button"
                      onClick={() => handleReturnToApp(screen === 'pending' ? 'pending' : screen === 'success' ? 'success' : 'failed')}
                      className="mt-4 inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/15"
                    >
                      Return to app
                    </button>
                  )}
                </div>
              )}

              <div className="mt-6 space-y-3 text-xs leading-5 text-slate-400">
                <p>Need help? Reopen checkout from the app if the handoff expired, or contact support.</p>
                <div className="flex flex-wrap gap-3">
                  <a href="/terms-and-conditions" className="hover:text-white">
                    Terms
                  </a>
                  <a href="/privacy-policy" className="hover:text-white">
                    Privacy
                  </a>
                  <a href="/refund-policy" className="hover:text-white">
                    Refunds
                  </a>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </>
  )
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center">
      <div className="h-12 w-12 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
      <p className="mt-5 text-sm font-medium text-slate-600">{label}</p>
    </div>
  )
}

function getQueryParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
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
