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
type AuthMode = 'unknown' | 'cookie' | 'bearer' | 'unauthenticated'

type ResultState = {
  title: string
  message: string
  tone: 'success' | 'warning' | 'danger'
  returnUrl?: string
}

type PlanMetrics = {
  monthlyPaise: number
  dailyPaise: number
  compareAmountPaise: number | null
  savingsPaise: number
  savePercent: number
}

const HERO_PILLS = [
  '24/7 Study Rooms',
  'Focus Mode',
  'Live Mentorship',
  'Mental Health Support',
  'Exam Communities',
]

const INCLUDED_FEATURES = [
  '24x7 Live Study Rooms',
  'Focus App Blocker',
  'Revision Tracker',
  'Live Mentorship',
  'Psychiatrist Sessions',
  'Daily Yoga & Meditation',
  'Exam Communities',
  'Girls-Only Group',
]

const TESTIMONIALS = [
  {
    name: 'Rajesh S.',
    exam: 'UPSC Aspirant',
    quote:
      'Study rooms changed how I prepare. Seeing focused people every day made consistency easier.',
    initials: 'RS',
    tone: 'violet',
  },
  {
    name: 'Priya A.',
    exam: 'NEET PG',
    quote:
      'The mentorship and mental health support made this feel sustainable instead of overwhelming.',
    initials: 'PA',
    tone: 'emerald',
  },
]

const FOOTER_ASSURANCES = [
  'Secure Pay',
  'Instant Access',
  'Cancel Anytime',
]

export default function PaymentPage() {
  const router = useRouter()
  const pendingPollRef = useRef<number | null>(null)
  const deepLinkTimeoutRef = useRef<number | null>(null)

  const [authMode, setAuthMode] = useState<AuthMode>('unknown')
  const [screen, setScreen] = useState<ScreenState>('booting')
  const [plans, setPlans] = useState<BillingPlan[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [pageError, setPageError] = useState('')
  const [authError, setAuthError] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpRequested, setOtpRequested] = useState(false)
  const [otpLoading, setOtpLoading] = useState(false)
  const [otpAction, setOtpAction] = useState<'send' | 'verify' | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [couponCode, setCouponCode] = useState('')
  const [razorpayReady, setRazorpayReady] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
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

    return Array.from(groups.values())
      .map((group) => ({
        course: group.course,
        plans: [...group.plans].sort((left, right) => left.durationMonths - right.durationMonths),
      }))
      .sort((left, right) => {
        return (left.course.displayOrder || 0) - (right.course.displayOrder || 0)
      })
  }, [plans])

  const activeCourseId = selectedCourse?.courseId || groupedPlans[0]?.course.courseId || ''

  const activeGroup = useMemo(() => {
    return groupedPlans.find((group) => group.course.courseId === activeCourseId) || groupedPlans[0] || null
  }, [activeCourseId, groupedPlans])

  const activePlans = activeGroup?.plans || []

  const basePlan = useMemo(() => {
    return [...activePlans].sort((left, right) => {
      if (left.durationMonths !== right.durationMonths) {
        return left.durationMonths - right.durationMonths
      }

      return left.amountPaise - right.amountPaise
    })[0] || null
  }, [activePlans])

  const popularPlanId = useMemo(() => {
    if (!activePlans.length) {
      return ''
    }

    return (
      activePlans.find((plan) => plan.durationMonths === 12)?.planId ||
      activePlans.find((plan) => plan.durationMonths === 6)?.planId ||
      activePlans[Math.min(1, activePlans.length - 1)]?.planId ||
      activePlans[0]?.planId ||
      ''
    )
  }, [activePlans])

  const selectedPlanMetrics = useMemo(() => {
    return selectedPlan ? getPlanMetrics(selectedPlan, basePlan) : null
  }, [basePlan, selectedPlan])

  const canRetryCheckout = screen === 'ready' || screen === 'failed'
  const canSelectPlan = screen === 'ready' || screen === 'failed'
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

  useEffect(() => {
    if (!router.isReady) {
      return
    }

    void bootstrap()
  }, [router.isReady])

  useEffect(() => {
    if (!activeGroup?.plans.length) {
      return
    }

    const hasSelectedPlan = activeGroup.plans.some((plan) => plan.planId === selectedPlanId)

    if (!hasSelectedPlan) {
      setSelectedPlanId(activeGroup.plans[0].planId)
    }
  }, [activeGroup, selectedPlanId])

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

  function openOtpScreen(message: string) {
    setAuthMode('unauthenticated')
    setOtpRequested(false)
    setOtp('')
    setScreen('otp')
    setAuthError(message)
    setPageError('')
    setStatusNote('Sign in to continue with payment.')
    postMobileEvent('AUTH_REQUIRED')
  }

  function ensureAuthorization(message: string) {
    if (tokenStore.getAccessToken()) {
      return true
    }

    if (authMode === 'cookie') {
      return true
    }

    openOtpScreen(message)
    return false
  }

  async function bootstrap() {
    setPageError('')
    setAuthError('')
    setCourseError('')
    setStatusNote('Loading payment options...')
    setResult(null)
    setAuthMode(tokenStore.getAccessToken() ? 'bearer' : 'unknown')

    await loadPlans()
  }

  async function loadPlans() {
    try {
      setScreen('booting')
      const planIdFromQuery = getQueryParam(router.query.planId)
      const data = await apiFetch<BillingPlansResponse>('/billing/plans', {
        headers: {
          Accept: 'application/json',
        },
      })
      setAuthMode(tokenStore.getAccessToken() ? 'bearer' : 'cookie')

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
        openOtpScreen('Your session is missing or expired. Sign in with your phone number to continue.')
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
      if (error instanceof PaymentApiError && error.status === 401) {
        tokenStore.clear()
        openOtpScreen('Your session expired while loading course options. Sign in again to continue.')
        return
      }

      setScreen('error')
      setPageError(getErrorMessage(error, 'Unable to load course options. Please try again.'))
    } finally {
      setCourseLoading(false)
    }
  }

  async function handleRequestOtp() {
    setOtpLoading(true)
    setOtpAction('send')
    setAuthError('')

    try {
      await requestOtp(phone)
      setOtpRequested(true)
      setStatusNote('We sent an OTP to your phone number.')
    } catch (error) {
      setAuthError(getErrorMessage(error, 'Could not send OTP. Please try again.'))
    } finally {
      setOtpLoading(false)
      setOtpAction(null)
    }
  }

  async function handleVerifyOtp() {
    setOtpLoading(true)
    setOtpAction('verify')
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
      setAuthMode('bearer')
      postMobileEvent('AUTH_SUCCESS')
      await loadPlans()
    } catch (error) {
      setAuthError(getErrorMessage(error, 'OTP verification failed. Please try again.'))
    } finally {
      setOtpLoading(false)
      setOtpAction(null)
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

    if (selectedCourseChoice === customCourseOption?.key && !customCourseTitle.trim()) {
      setCourseError('Enter your exam name to continue.')
      return
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
      if (error instanceof PaymentApiError && error.status === 401) {
        tokenStore.clear()
        openOtpScreen('Your session expired while saving your course. Sign in again to continue.')
        return
      }

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
    setResult(null)
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
        openOtpScreen('Your session expired. Sign in again to continue.')
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
        color: '#7c3aed',
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
        setShowSuccessModal(true)
        setResult({
          title: 'Access unlocked',
          message: `Payment confirmed for ${order.course.title}. You can continue in the app or stay on this page.`,
          tone: 'success',
          returnUrl: verification.returnUrl,
        })
        setStatusNote('Payment completed successfully.')
        postMobileEvent('PAYMENT_SUCCESS', {
          status: 'success',
          planId: order.plan.planId,
          courseId: order.course.courseId,
          paymentStatus: verification.paymentStatus,
          returnUrl: verification.returnUrl,
          redirectUrl: getReturnTarget(verification.returnUrl, 'success'),
        })
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
          status: 'pending',
          planId: order.plan.planId,
          courseId: order.course.courseId,
          paymentStatus: verification.paymentStatus,
          returnUrl: verification.returnUrl,
          redirectUrl: getReturnTarget(verification.returnUrl, 'pending'),
        })
        scheduleReturnToApp(verification.returnUrl, 'pending')
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
        status: 'failed',
        planId: order.plan.planId,
        courseId: order.course.courseId,
        paymentStatus: verification.paymentStatus,
        returnUrl: verification.returnUrl,
        redirectUrl: getReturnTarget(verification.returnUrl, 'failed'),
      })
      scheduleReturnToApp(verification.returnUrl, 'failed')
    } catch (error) {
      if (error instanceof PaymentApiError && error.status === 401) {
        tokenStore.clear()
        openOtpScreen('Your session expired before payment verification completed. Sign in again to refresh access.')
        setCheckoutLoading(false)
        return
      }

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
          setShowSuccessModal(true)
          setResult({
            title: 'Access unlocked',
            message: 'Your course access is active now.',
            tone: 'success',
            returnUrl: context.returnUrl,
          })
          setStatusNote('Payment completed successfully.')
          postMobileEvent('PAYMENT_SUCCESS', {
            status: 'success',
            courseId: context.courseId,
            returnUrl: context.returnUrl,
            redirectUrl: getReturnTarget(context.returnUrl, 'success'),
          })
          return
        }
      } catch {
        // Best-effort polling while the payment is pending.
      }

      if (attempts >= 8 && pendingPollRef.current) {
        window.clearInterval(pendingPollRef.current)
        pendingPollRef.current = null
      }
    }, 3000)
  }

  function getReturnTarget(returnUrl: string | undefined, status: 'success' | 'pending' | 'failed') {
    if (!returnUrl) {
      return null
    }

    return buildReturnUrl(returnUrl, status)
  }

  function scheduleReturnToApp(returnUrl: string | undefined, status: 'success' | 'pending' | 'failed') {
    const targetUrl = getReturnTarget(returnUrl, status)

    if (!targetUrl) {
      return
    }

    if (deepLinkTimeoutRef.current) {
      window.clearTimeout(deepLinkTimeoutRef.current)
    }

    postMobileEvent('OPEN_RETURN_URL', {
      status,
      returnUrl,
      redirectUrl: targetUrl,
    })

    deepLinkTimeoutRef.current = window.setTimeout(() => {
      window.location.assign(targetUrl)
    }, 600)
  }

  function handleReturnToApp(status: 'success' | 'pending' | 'failed') {
    if (!result?.returnUrl) {
      return
    }

    scheduleReturnToApp(result.returnUrl, status)
  }

  function handleCloseSuccessModal() {
    setShowSuccessModal(false)

    if (result?.returnUrl) {
      handleReturnToApp('success')
    }
  }

  function handleBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }

    void router.push('/')
  }

  function handleSelectCourseGroup(courseId: string) {
    const nextGroup = groupedPlans.find((group) => group.course.courseId === courseId)

    if (!nextGroup) {
      return
    }

    setSelectedCourse(nextGroup.course)
    setSelectedPlanId(nextGroup.plans[0]?.planId || '')
  }

  function handleApplyCoupon() {
    if (!couponCode.trim() || typeof window === 'undefined') {
      return
    }

    window.alert('Coupon code support is coming soon.')
  }

  function renderBodyContent() {
    if (screen === 'booting') {
      return (
        <div className="py-14">
          <LoadingPanel label="Preparing your checkout..." />
        </div>
      )
    }

    if (screen === 'otp') {
      return (
        <div className="space-y-4">
          <SectionHeading
            eyebrow="Sign In"
            title="Verify your phone number"
            description="We need a valid session before creating the order. Enter your mobile number and the OTP from the backend."
          />

          <InputField
            label="Phone number"
            hint="+91"
            value={phone}
            onChange={(value) => setPhone(value.replace(/\D/g, '').slice(0, 10))}
            placeholder="9876543210"
            inputMode="numeric"
            disabled={otpLoading}
          />

          {otpRequested && (
            <InputField
              label="OTP"
              value={otp}
              onChange={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter the 6-digit OTP"
              inputMode="numeric"
              disabled={otpLoading}
            />
          )}

          {authError && <MessageBanner tone="danger">{authError}</MessageBanner>}

          <div className="grid gap-3">
            {otpRequested ? (
              <>
                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={otpLoading || otp.length < 4}
                  className="rounded-[18px] bg-[#7c3aed] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(124,58,237,0.25)] transition hover:bg-[#6d28d9] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {otpLoading && otpAction === 'verify' ? 'Verifying...' : 'Verify and continue'}
                </button>

                <button
                  type="button"
                  onClick={handleRequestOtp}
                  disabled={otpLoading}
                  className="rounded-[18px] border border-[#d9cdf6] bg-white px-4 py-3.5 text-sm font-semibold text-[#5b21b6] transition hover:border-[#7c3aed] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {otpLoading && otpAction === 'send' ? 'Resending OTP...' : 'Resend OTP'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleRequestOtp}
                disabled={otpLoading}
                className="rounded-[18px] bg-[#7c3aed] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(124,58,237,0.25)] transition hover:bg-[#6d28d9] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {otpLoading && otpAction === 'send' ? 'Sending OTP...' : 'Send OTP'}
              </button>
            )}
          </div>
        </div>
      )
    }

    if (screen === 'course') {
      return (
        <div className="space-y-4">
          <SectionHeading
            eyebrow="Choose Your Course"
            title="Pick the exam you are preparing for"
            description="We load plan options based on your course. Select one from the catalog or create a custom exam title."
          />

          <div className="grid gap-3">
            {courseOptions.map((course) => {
              const isActive = selectedCourseChoice === course.courseId

              return (
                <button
                  key={course.courseId}
                  type="button"
                  onClick={() => setSelectedCourseChoice(course.courseId)}
                  className={cn(
                    'rounded-[22px] border p-4 text-left transition',
                    isActive
                      ? 'border-[#7c3aed] bg-[#f3edff] shadow-[0_18px_34px_rgba(124,58,237,0.14)]'
                      : 'border-[#ebe3fb] bg-white hover:border-[#cbb7f7]'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <SelectionDot active={isActive} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{course.title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {course.description || 'Load the matching billing plans for this exam.'}
                      </p>
                    </div>
                  </div>
                </button>
              )
            })}

            {customCourseOption && (
              <button
                type="button"
                onClick={() => setSelectedCourseChoice(customCourseOption.key)}
                className={cn(
                  'rounded-[22px] border p-4 text-left transition',
                  isCustomCourseSelected
                    ? 'border-[#7c3aed] bg-[#f3edff] shadow-[0_18px_34px_rgba(124,58,237,0.14)]'
                    : 'border-[#ebe3fb] bg-white hover:border-[#cbb7f7]'
                )}
              >
                <div className="flex items-start gap-3">
                  <SelectionDot active={isCustomCourseSelected} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{customCourseOption.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Create a custom exam track if your course is not listed here.
                    </p>
                  </div>
                </div>
              </button>
            )}
          </div>

          {isCustomCourseSelected && (
            <InputField
              label="Exam name"
              value={customCourseTitle}
              onChange={setCustomCourseTitle}
              placeholder="For example, AFCAT"
              disabled={courseLoading}
            />
          )}

          {courseError && <MessageBanner tone="danger">{courseError}</MessageBanner>}

          <div className="grid gap-3">
            <button
              type="button"
              onClick={handleSaveCourseSelection}
              disabled={courseLoading}
              className="rounded-[18px] bg-[#7c3aed] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(124,58,237,0.25)] transition hover:bg-[#6d28d9] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {courseLoading ? 'Saving course...' : 'Continue to plans'}
            </button>

            <button
              type="button"
              onClick={() => {
                tokenStore.clear()
                openOtpScreen('Sign in again to choose a different account.')
              }}
              className="rounded-[18px] border border-[#d9cdf6] bg-white px-4 py-3.5 text-sm font-semibold text-[#5b21b6] transition hover:border-[#7c3aed]"
            >
              Use another account
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-7">
        {groupedPlans.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {groupedPlans.map((group) => {
              const isActive = group.course.courseId === activeGroup?.course.courseId

              return (
                <button
                  key={group.course.courseId}
                  type="button"
                  onClick={() => handleSelectCourseGroup(group.course.courseId)}
                  disabled={!canSelectPlan}
                  className={cn(
                    'shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition',
                    isActive
                      ? 'bg-[#7c3aed] text-white shadow-[0_14px_24px_rgba(124,58,237,0.25)]'
                      : 'bg-white text-slate-600 ring-1 ring-[#e7dcfb]',
                    !canSelectPlan && 'cursor-not-allowed opacity-70'
                  )}
                >
                  {group.course.title}
                </button>
              )
            })}
          </div>
        )}

        {selectedPlanMetrics && (
          <div className="rounded-[24px] border border-[#eee6fb] bg-white px-5 py-5 shadow-[0_10px_24px_rgba(109,40,217,0.05)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8b5cf6]">Selected Plan</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {selectedPlan?.name || `${selectedPlan?.durationMonths || 0} Month Plan`}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Costs about {formatCurrency(selectedPlanMetrics.dailyPaise, selectedPlan?.currency)} per day
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-extrabold tracking-tight text-[#6d28d9]">
                  {formatCurrency(selectedPlan?.amountPaise || 0, selectedPlan?.currency)}
                </p>
                <p className="text-xs font-medium text-slate-500">
                  {formatCurrency(selectedPlanMetrics.monthlyPaise, selectedPlan?.currency)} /mo
                </p>
              </div>
            </div>
          </div>
        )}

        {result && screen !== 'success' && (
          <div className={cn(
            'rounded-[22px] border px-4 py-4',
            result.tone === 'success' && 'border-emerald-200 bg-emerald-50',
            result.tone === 'warning' && 'border-amber-200 bg-amber-50',
            result.tone === 'danger' && 'border-rose-200 bg-rose-50'
          )}>
            <p className={cn(
              'text-sm font-semibold',
              result.tone === 'success' && 'text-emerald-900',
              result.tone === 'warning' && 'text-amber-900',
              result.tone === 'danger' && 'text-rose-900'
            )}>
              {result.title}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-600">{result.message}</p>
            {result.returnUrl && (
              <button
                type="button"
                onClick={() => handleReturnToApp(screen === 'pending' ? 'pending' : 'failed')}
                className="mt-3 inline-flex items-center rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#6d28d9] ring-1 ring-[#d9cdf6] transition hover:ring-[#7c3aed]"
              >
                Return to app
              </button>
            )}
          </div>
        )}

        {pageError && <MessageBanner tone="danger">{pageError}</MessageBanner>}

        {screen === 'error' && pageError && (
          <div className="grid gap-3">
            <button
              type="button"
              onClick={() => void bootstrap()}
              className="rounded-[18px] bg-[#7c3aed] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(124,58,237,0.25)] transition hover:bg-[#6d28d9]"
            >
              Retry
            </button>
            <a
              href="/payment/error?code=HANDOFF_INVALID"
              className="rounded-[18px] border border-[#d9cdf6] bg-white px-4 py-3.5 text-center text-sm font-semibold text-[#5b21b6] transition hover:border-[#7c3aed]"
            >
              Open help
            </a>
          </div>
        )}

        {activePlans.length > 0 && (
          <div>
            <SectionHeading
              eyebrow="Choose Your Plan"
              title="Pick the access window that fits your prep"
              description="All plans unlock the same system. The longer options reduce your monthly cost."
            />

            <div className="mt-5 space-y-4">
              {activePlans.map((plan) => {
                const metrics = getPlanMetrics(plan, basePlan)
                const tag = getPlanTag(plan, metrics, popularPlanId)

                return (
                  <PlanOptionCard
                    key={plan.planId}
                    plan={plan}
                    metrics={metrics}
                    active={selectedPlanId === plan.planId}
                    disabled={!canSelectPlan}
                    tag={tag}
                    onSelect={() => setSelectedPlanId(plan.planId)}
                  />
                )
              })}
            </div>
          </div>
        )}

        <div className="grid gap-4">
          {TESTIMONIALS.map((testimonial) => (
            <div key={testimonial.name} className="rounded-[24px] border border-[#eee6fb] bg-white p-5">
              <div className="flex items-start gap-3">
                <div className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white',
                  testimonial.tone === 'violet' ? 'bg-[#7c3aed]' : 'bg-[#10b981]'
                )}>
                  {testimonial.initials}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{testimonial.name}</p>
                  <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400">{testimonial.exam}</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-600">&quot;{testimonial.quote}&quot;</p>
            </div>
          ))}
        </div>

        <div className="rounded-[24px] border border-[#eee6fb] bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Have a coupon code?</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Enter your code below. Coupon support is being wired into this checkout.
              </p>
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <input
              type="text"
              value={couponCode}
              onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
              placeholder="Enter coupon code"
              className="min-w-0 flex-1 rounded-[18px] border border-[#e6def7] bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#a78bfa] focus:ring-0"
            />

            <button
              type="button"
              onClick={handleApplyCoupon}
              disabled={!couponCode.trim()}
              className="shrink-0 rounded-[18px] bg-[#f3edff] px-5 py-3 text-sm font-semibold text-[#6d28d9] transition hover:bg-[#e8ddff] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Apply
            </button>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Everything included</p>
              <p className="mt-1 text-xs text-slate-500">Same benefits across all current plans.</p>
            </div>
            <span className="rounded-full bg-[#f3edff] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7c3aed]">
              {INCLUDED_FEATURES.length} features
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {INCLUDED_FEATURES.map((feature) => (
              <div
                key={feature}
                className="flex min-h-[68px] items-center gap-2 rounded-[18px] border border-[#ebe3fb] bg-white px-3 py-3 text-xs font-medium text-slate-700 shadow-[0_10px_20px_rgba(90,24,154,0.04)]"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e9ddff] text-[#6d28d9]">
                  <CheckIcon className="h-3.5 w-3.5" />
                </span>
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  function renderFooterAction() {
    if (screen === 'booting' || screen === 'otp' || screen === 'course' || screen === 'error' || screen === 'success') {
      return null
    }

    const footerPrice = selectedPlanMetrics && selectedPlan
      ? `${formatCurrency(selectedPlanMetrics.monthlyPaise, selectedPlan.currency)} /mo`
      : null

    let label = 'Start Learning Now'
    let disabled = false
    let onClick: (() => void) | undefined = undefined
    let helper = 'Secure payment powered by Razorpay.'

    if (screen === 'processing') {
      label = 'Verifying payment...'
      disabled = true
      helper = 'Do not close this page while verification is running.'
    } else if (screen === 'pending') {
      label = result?.returnUrl ? 'Return to app' : 'Payment pending'
      disabled = !result?.returnUrl
      onClick = result?.returnUrl ? () => handleReturnToApp('pending') : undefined
      helper = 'Access will unlock as soon as backend verification completes.'
    } else if (screen === 'failed') {
      label = 'Try Secure Checkout Again'
      disabled = checkoutLoading || !razorpayReady
      onClick = handlePayNow
      helper = 'Retry the order once you are ready.'
    } else {
      label = checkoutLoading ? 'Preparing checkout...' : 'Start Learning Now'
      disabled = checkoutLoading || !razorpayReady || !selectedPlan || !canRetryCheckout
      onClick = handlePayNow
    }

    return (
      <div className="mt-6 rounded-t-[28px] border-t border-[#ece2ff] bg-[#fbf8ff] px-4 pb-4 pt-4">
        <div className="grid grid-cols-3 gap-2">
          {FOOTER_ASSURANCES.map((item) => (
            <div
              key={item}
              className="rounded-[18px] border border-[#ebe3fb] bg-white px-3 py-3 text-center text-[11px] font-semibold text-slate-500"
            >
              {item}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-[18px] bg-[#7c3aed] px-4 py-4 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(124,58,237,0.28)] transition hover:bg-[#6d28d9] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span>{label}</span>
          {footerPrice && (screen === 'ready' || screen === 'failed') && <span className="text-white/80">{footerPrice}</span>}
          {(screen === 'ready' || screen === 'failed') && <ArrowRightIcon className="h-4 w-4" />}
        </button>

        <p className="mt-2 text-center text-[11px] leading-5 text-slate-500">
          Secure payment, instant access, no hidden fees. {helper}
        </p>
      </div>
    )
  }

  const heroTitle =
    screen === 'otp'
      ? 'Sign in to unlock your checkout'
      : screen === 'course'
        ? 'Choose the right exam track first'
        : 'Your complete study system awaits'

  const heroDescription =
    screen === 'otp'
      ? 'Secure your access with OTP verification before we create the payment order.'
      : screen === 'course'
        ? 'Your plan options depend on your exam. Pick a course and we will load the matching pricing.'
        : 'Study rooms, focus tools, mentorship, wellness support, and exam communities in one plan.'

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

      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),_rgba(243,236,255,1)_38%,_rgba(239,235,248,1)_100%)] px-3 py-4 text-slate-900 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-[440px]">
          <div className="overflow-hidden rounded-[34px] border border-white/70 bg-white shadow-[0_30px_80px_rgba(76,29,149,0.16)]">
            <div className="relative overflow-hidden bg-[linear-gradient(160deg,#7024e6_0%,#8d48f5_55%,#6d28d9_100%)] px-4 pb-5 pt-4 text-white">
              <div className="absolute -right-10 top-0 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute left-[-20%] top-[48%] h-40 w-40 rounded-full bg-[#c084fc]/30 blur-3xl" />

              <div className="relative z-10">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-2 text-xs font-medium text-white backdrop-blur transition hover:bg-white/18"
                  >
                    <ChevronLeftIcon className="h-3.5 w-3.5" />
                    Back
                  </button>

                  <div className="rounded-full bg-white/14 px-3 py-2 text-[11px] font-semibold tracking-[0.18em] text-white/90 backdrop-blur">
                    {selectedCoursePreview?.title || activeGroup?.course.title || 'Virtual Library'}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 text-[11px] text-white/85">
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-0.5 text-[#fcd34d]">
                      {[0, 1, 2, 3, 4].map((star) => (
                        <StarIcon key={star} className="h-3 w-3 fill-current" />
                      ))}
                    </div>
                    <span className="font-medium">4.9 rated checkout</span>
                  </div>
                  <div className="rounded-full bg-emerald-400/15 px-3 py-1 font-medium text-emerald-100">
                    {statusNote}
                  </div>
                </div>

                <h1 className="mt-5 max-w-[13ch] text-[2rem] font-extrabold leading-[1.04] tracking-[-0.04em] text-white">
                  {heroTitle}
                </h1>

                <p className="mt-3 max-w-[30ch] text-sm leading-6 text-white/78">
                  {heroDescription}
                </p>

                <div className="mt-4 flex items-center gap-3">
                  <div className="flex -space-x-2">
                    {['A', 'S', 'D'].map((letter, index) => (
                      <div
                        key={letter}
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#7c3aed] text-xs font-bold text-white',
                          index === 0 && 'bg-[#f97316]',
                          index === 1 && 'bg-[#3b82f6]',
                          index === 2 && 'bg-[#ef4444]'
                        )}
                      >
                        {letter}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs font-medium text-white/82">Built for aspirants who need structure, focus, and support.</p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {HERO_PILLS.map((pill) => (
                    <span
                      key={pill}
                      className="rounded-full border border-white/12 bg-white/12 px-3 py-1.5 text-[11px] font-medium text-white/90 backdrop-blur"
                    >
                      {pill}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-[#fcfbff] px-4 pb-4 pt-4">
              {renderBodyContent()}
            </div>

            {renderFooterAction()}
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-4 text-[11px] font-medium text-slate-500">
            <a href="/terms-and-conditions" className="transition hover:text-[#6d28d9]">
              Terms
            </a>
            <a href="/privacy-policy" className="transition hover:text-[#6d28d9]">
              Privacy
            </a>
            <a href="/refund-policy" className="transition hover:text-[#6d28d9]">
              Refunds
            </a>
          </div>
        </div>
      </div>

      <SuccessCompletionModal
        isOpen={showSuccessModal && screen === 'success'}
        message={result?.message}
        onClose={handleCloseSuccessModal}
      />
    </>
  )
}

function PlanOptionCard({
  active,
  disabled,
  metrics,
  onSelect,
  plan,
  tag,
}: {
  active: boolean
  disabled: boolean
  metrics: PlanMetrics
  onSelect: () => void
  plan: BillingPlan
  tag: string | null
}) {
  const note =
    metrics.savingsPaise > 0
      ? `You save ${formatCurrency(metrics.savingsPaise, plan.currency)} vs renewing the shortest plan`
      : 'Start with the shortest commitment and upgrade later'

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'w-full rounded-[26px] border p-5 text-left transition',
        active
          ? 'border-[#d9c5ff] bg-white shadow-[0_14px_28px_rgba(124,58,237,0.08)]'
          : 'border-[#eee6fb] bg-white hover:border-[#d9c5ff]',
        disabled && 'cursor-not-allowed opacity-75'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <SelectionDot active={active} />

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-semibold text-slate-900">{formatPlanDuration(plan.durationMonths)}</p>
              {tag && (
                <span
                  className={cn(
                    'rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]',
                    tag === 'Most popular' ? 'bg-[#ffedd5] text-[#ea580c]' : 'bg-[#e7f9f3] text-[#0f766e]'
                  )}
                >
                  {tag}
                </span>
              )}
            </div>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              {formatCurrency(metrics.monthlyPaise, plan.currency)} /mo billed as {formatCurrency(plan.amountPaise, plan.currency)}
            </p>
          </div>
        </div>

        <div className="shrink-0 text-right">
          {metrics.compareAmountPaise && metrics.compareAmountPaise > plan.amountPaise && (
            <p className="text-[11px] font-medium text-slate-400 line-through">
              {formatCurrency(metrics.compareAmountPaise, plan.currency)}
            </p>
          )}
          <p className="text-3xl font-extrabold tracking-[-0.04em] text-[#6d28d9]">
            {formatCurrency(plan.amountPaise, plan.currency)}
          </p>
          <p className="mt-1 text-[11px] font-medium text-[#8b5cf6]">
            {formatCurrency(metrics.dailyPaise, plan.currency)} /day
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-[#f2ebff] pt-4 text-xs text-slate-600">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f3edff] text-[#6d28d9]">
          <CheckIcon className="h-3.5 w-3.5" />
        </span>
        <span>{note}</span>
      </div>
    </button>
  )
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center">
      <div className="h-12 w-12 animate-spin rounded-full border-2 border-[#d9cdf6] border-t-[#7c3aed]" />
      <p className="mt-5 text-sm font-medium text-slate-600">{label}</p>
    </div>
  )
}

function SectionHeading({
  description,
  eyebrow,
  title,
}: {
  description: string
  eyebrow: string
  title: string
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8b5cf6]">{eyebrow}</p>
      <h2 className="mt-2 text-[1.45rem] font-bold tracking-[-0.03em] text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  )
}

function InputField({
  disabled,
  hint,
  inputMode,
  label,
  onChange,
  placeholder,
  value,
}: {
  disabled?: boolean
  hint?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  label: string
  onChange: (value: string) => void
  placeholder: string
  value: string
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <div className="flex items-center rounded-[18px] border border-[#e6def7] bg-white px-4 shadow-[0_10px_20px_rgba(90,24,154,0.04)]">
        {hint && <span className="mr-3 text-sm font-semibold text-slate-400">{hint}</span>}
        <input
          type="text"
          inputMode={inputMode}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full border-0 bg-transparent px-0 py-4 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-0"
        />
      </div>
    </label>
  )
}

function MessageBanner({
  children,
  tone,
}: {
  children: React.ReactNode
  tone: 'danger' | 'success' | 'warning'
}) {
  return (
    <div
      className={cn(
        'rounded-[18px] border px-4 py-3 text-sm',
        tone === 'danger' && 'border-rose-200 bg-rose-50 text-rose-700',
        tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
        tone === 'warning' && 'border-amber-200 bg-amber-50 text-amber-700'
      )}
    >
      {children}
    </div>
  )
}

function SelectionDot({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition',
        active ? 'border-[#7c3aed] bg-[#7c3aed]' : 'border-[#cbb7f7] bg-white'
      )}
    >
      <span className={cn('h-2 w-2 rounded-full bg-white', !active && 'opacity-0')} />
    </span>
  )
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path d="M12.5 4.5L7 10l5.5 5.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  )
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path d="M4.5 10h11" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M11 5.5L15.5 10 11 14.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={className}>
      <path d="M5 10.5l3.2 3.2L15 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  )
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <path d="M10 2.4l2.3 4.7 5.2.8-3.8 3.8.9 5.3L10 14.6 5.4 17l.9-5.3L2.5 7.9l5.2-.8L10 2.4z" />
    </svg>
  )
}

function SuccessCompletionModal({
  isOpen,
  message,
  onClose,
}: {
  isOpen: boolean
  message?: string
  onClose: () => void
}) {
  useEffect(() => {
    if (!isOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(17,24,39,0.42)] p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-[32px] bg-white p-6 text-center shadow-[0_34px_80px_rgba(76,29,149,0.24)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f3edff] text-[#6d28d9]">
          <CheckIcon className="h-7 w-7" />
        </div>

        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8b5cf6]">
          Payment Completed
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-slate-950">
          Your payment was successful
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          {message || 'Payment confirmed successfully.'}
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Close this modal to get access to our latest features.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-[18px] bg-[#7c3aed] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(124,58,237,0.24)] transition hover:bg-[#6d28d9]"
        >
          Close and continue
        </button>
      </div>
    </div>
  )
}

function getPlanMetrics(plan: BillingPlan, basePlan: BillingPlan | null): PlanMetrics {
  const safeDuration = Math.max(plan.durationMonths, 1)
  const monthlyPaise = Math.round(plan.amountPaise / safeDuration)
  const dailyPaise = Math.max(1, Math.round(plan.amountPaise / (safeDuration * 30)))

  if (!basePlan) {
    return {
      monthlyPaise,
      dailyPaise,
      compareAmountPaise: null,
      savingsPaise: 0,
      savePercent: 0,
    }
  }

  const baseMonthlyPaise = Math.round(basePlan.amountPaise / Math.max(basePlan.durationMonths, 1))
  const compareAmountPaise = baseMonthlyPaise * safeDuration
  const savingsPaise = Math.max(0, compareAmountPaise - plan.amountPaise)
  const savePercent = compareAmountPaise > 0 ? Math.round((savingsPaise / compareAmountPaise) * 100) : 0

  return {
    monthlyPaise,
    dailyPaise,
    compareAmountPaise: compareAmountPaise > plan.amountPaise ? compareAmountPaise : null,
    savingsPaise,
    savePercent,
  }
}

function getPlanTag(plan: BillingPlan, metrics: PlanMetrics, popularPlanId: string) {
  if (plan.planId === popularPlanId) {
    return 'Most popular'
  }

  if (metrics.savePercent > 0) {
    return `Save ${metrics.savePercent}%`
  }

  return null
}

function formatPlanDuration(durationMonths: number) {
  return `${durationMonths} ${durationMonths === 1 ? 'Month' : 'Months'}`
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

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}
