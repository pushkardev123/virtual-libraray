import Head from 'next/head'
import Script from 'next/script'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  apiFetch,
  BillingOrderResponse,
  BillingPlan,
  BillingPlansResponse,
  BillingPricing,
  BillingQuoteResponse,
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
  compareAmountPaise: number | null
}

type CheckoutActionState = {
  disabled: boolean
  label: string
  onClick?: () => void
  showArrow: boolean
}

export default function PaymentPage() {
  const router = useRouter()
  const pendingPollRef = useRef<number | null>(null)
  const deepLinkTimeoutRef = useRef<number | null>(null)
  const selectedPlanIdRef = useRef('')

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
  const [appliedCouponCode, setAppliedCouponCode] = useState('')
  const [couponQuote, setCouponQuote] = useState<BillingQuoteResponse | null>(null)
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponMessage, setCouponMessage] = useState('')
  const [couponError, setCouponError] = useState('')
  const [razorpayReady, setRazorpayReady] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [result, setResult] = useState<ResultState | null>(null)
  const [, setStatusNote] = useState('Loading payment options...')
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
  const checkoutPricing = useMemo(
    () => getCheckoutPricing(selectedPlan, couponQuote),
    [couponQuote, selectedPlan]
  )
  const activeCouponCode = couponQuote?.couponStatus === 'APPLIED' && couponQuote.isValidCoupon
    ? couponQuote.coupon?.code || appliedCouponCode
    : ''

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
  const checkoutSource = getQueryParam(router.query.source)
  const shouldUseV2WebFallback = checkoutSource === 'v2-neet-pg'

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
    return getDefaultPlanId(activePlans)
  }, [activePlans])

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
      setSelectedPlanId(getDefaultPlanId(activeGroup.plans))
    }
  }, [activeGroup, selectedPlanId])

  useEffect(() => {
    selectedPlanIdRef.current = selectedPlanId
  }, [selectedPlanId])

  useEffect(() => {
    setCouponCode('')
    setAppliedCouponCode('')
    setCouponQuote(null)
    setCouponMessage('')
    setCouponError('')
  }, [selectedPlanId])

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

  function openOtpScreen(statusMessage = 'Sign in with your phone number to continue.') {
    setAuthMode('unauthenticated')
    setOtpRequested(false)
    setOtp('')
    setScreen('otp')
    setAuthError('')
    setPageError('')
    setStatusNote(statusMessage)
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
      setSelectedPlanId(getDefaultPlanId(availablePlans, planIdFromQuery))
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
        openOtpScreen('Sign in with your phone number to view plans.')
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
        openOtpScreen('Sign in to continue with course selection.')
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
    if (!ensureAuthorization('Sign in with your phone number to choose a course.')) {
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
        openOtpScreen('Sign in again to save your course selection.')
        return
      }

      setCourseError(getErrorMessage(error, 'Unable to save your course. Please try again.'))
    } finally {
      setCourseLoading(false)
    }
  }

  async function handleApplyCoupon() {
    const nextCouponCode = normalizeCouponInput(couponCode)

    if (!ensureAuthorization('Sign in with your phone number to apply a coupon.')) {
      return
    }

    if (!selectedPlan) {
      setCouponError('Select a plan before applying a coupon.')
      return
    }

    if (!nextCouponCode) {
      setCouponError('Enter a coupon code to apply.')
      return
    }

    setCouponLoading(true)
    setCouponError('')
    setCouponMessage('')
    setPageError('')

    try {
      const requestPlanId = selectedPlan.planId
      const quote = await apiFetch<BillingQuoteResponse>('/billing/quote', {
        method: 'POST',
        body: JSON.stringify({
          planId: requestPlanId,
          couponCode: nextCouponCode,
        }),
      })

      if (selectedPlanIdRef.current !== requestPlanId) {
        return
      }

      setCouponQuote(quote)

      if (quote.couponStatus === 'APPLIED' && quote.isValidCoupon) {
        const appliedCode = quote.coupon?.code || nextCouponCode
        setAppliedCouponCode(appliedCode)
        setCouponCode(appliedCode)
        setCouponMessage(quote.message || 'Coupon applied.')
        return
      }

      setAppliedCouponCode('')
      setCouponError(quote.message || 'Coupon is not valid for this plan.')
    } catch (error) {
      if (error instanceof PaymentApiError && error.status === 401) {
        tokenStore.clear()
        openOtpScreen('Sign in again to apply a coupon.')
        return
      }

      setAppliedCouponCode('')
      setCouponQuote(null)
      setCouponError(getErrorMessage(error, 'Could not apply coupon. Please try again.'))
    } finally {
      setCouponLoading(false)
    }
  }

  function handleRemoveCoupon() {
    setCouponCode('')
    setAppliedCouponCode('')
    setCouponQuote(null)
    setCouponMessage('')
    setCouponError('')
  }

  async function handlePayNow() {
    if (!ensureAuthorization('Sign in with your phone number to continue to payment.')) {
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
        body: JSON.stringify({
          planId: selectedPlan.planId,
          couponCode: activeCouponCode || undefined,
        }),
      })

      openRazorpayCheckout(order)
    } catch (error) {
      if (error instanceof PaymentApiError && error.status === 401) {
        tokenStore.clear()
        openOtpScreen('Sign in again to continue to payment.')
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
        color: '#6d28d9',
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
        openOtpScreen('Sign in again to refresh your payment status.')
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
      return
    }

    if (shouldUseV2WebFallback) {
      void router.push({
        pathname: '/v2/neet-pg/access',
        query: {
          status: 'success',
        },
      })
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
    setSelectedPlanId(getDefaultPlanId(nextGroup.plans))
  }

  function getCheckoutActionState(): CheckoutActionState | null {
    if (screen === 'booting' || screen === 'otp' || screen === 'course' || screen === 'error' || screen === 'success') {
      return null
    }

    let label = 'Continue to secure payment'
    let disabled = false
    let onClick: (() => void) | undefined = undefined
    let showArrow = false

    if (screen === 'processing') {
      label = 'Verifying payment...'
      disabled = true
    } else if (screen === 'pending') {
      label = result?.returnUrl ? 'Return to app' : 'Payment pending'
      disabled = !result?.returnUrl
      onClick = result?.returnUrl ? () => handleReturnToApp('pending') : undefined
    } else if (screen === 'failed') {
      label = checkoutPricing ? `Retry payment ${formatCurrency(checkoutPricing.finalAmountPaise, checkoutPricing.currency)}` : 'Retry payment'
      disabled = checkoutLoading || !razorpayReady
      onClick = handlePayNow
      showArrow = true
    } else {
      label = checkoutLoading
        ? 'Preparing checkout...'
        : checkoutPricing
          ? `Continue to pay ${formatCurrency(checkoutPricing.finalAmountPaise, checkoutPricing.currency)}`
          : 'Continue to pay'
      disabled = checkoutLoading || !razorpayReady || !selectedPlan || !canRetryCheckout
      onClick = handlePayNow
      showArrow = true
    }

    return {
      disabled,
      label,
      onClick,
      showArrow,
    }
  }

  function renderBodyContent() {
    if (screen === 'booting') {
      return (
        <div className="py-16">
          <LoadingPanel label="Preparing your checkout..." />
        </div>
      )
    }

    if (screen === 'otp') {
      return (
        <div className="space-y-6">
          <SectionHeading
            eyebrow="Sign In"
            title={otpRequested ? 'Enter your OTP' : 'Continue with your phone number'}
            description={
              otpRequested
                ? 'Use the one-time password sent to your mobile number to continue to checkout.'
                : 'We will send a one-time password to your mobile number before payment.'
            }
          />

          <div className="rounded-[28px] border border-[#e7dcfb] bg-[#faf7ff] p-4 shadow-[0_14px_30px_rgba(109,40,217,0.06)]">
            <div className="space-y-4">
              <InputField
                label="Phone number"
                hint="+91"
                value={phone}
                onChange={(value) => {
                  setPhone(value.replace(/\D/g, '').slice(0, 10))
                  setAuthError('')
                }}
                inputMode="numeric"
                disabled={otpLoading}
              />

              {otpRequested && (
                <InputField
                  label="OTP"
                  value={otp}
                  onChange={(value) => {
                    setOtp(value.replace(/\D/g, '').slice(0, 6))
                    setAuthError('')
                  }}
                  inputMode="numeric"
                  disabled={otpLoading}
                />
              )}
            </div>

            {authError && <div className="mt-4"><MessageBanner tone="danger">{authError}</MessageBanner></div>}

            <div className="mt-4 grid gap-3">
              {otpRequested ? (
                <>
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={otpLoading || otp.length < 4}
                    className="rounded-[18px] bg-[#6d28d9] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(109,40,217,0.20)] transition hover:bg-[#5b21b6] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {otpLoading && otpAction === 'verify' ? 'Verifying...' : 'Verify and continue'}
                  </button>

                  <button
                    type="button"
                    onClick={handleRequestOtp}
                    disabled={otpLoading}
                    className="rounded-[18px] border border-[#e6dbff] bg-white px-4 py-3.5 text-sm font-semibold text-[#6d28d9] transition hover:border-[#6d28d9] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {otpLoading && otpAction === 'send' ? 'Resending OTP...' : 'Resend OTP'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestOtp}
                  disabled={otpLoading}
                  className="rounded-[18px] bg-[#6d28d9] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(109,40,217,0.20)] transition hover:bg-[#5b21b6] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {otpLoading && otpAction === 'send' ? 'Sending OTP...' : 'Send OTP'}
                </button>
              )}
            </div>
          </div>
        </div>
      )
    }

    if (screen === 'course') {
      return (
        <div className="space-y-6">
          <SectionHeading
            eyebrow="Course"
            title="Choose your exam"
            description="We will load the most relevant plan options after you confirm your course."
          />

          <div className="grid gap-3">
            {courseOptions.map((course) => {
              const isActive = selectedCourseChoice === course.courseId

              return (
                <button
                  key={course.courseId}
                  type="button"
                  onClick={() => {
                    setSelectedCourseChoice(course.courseId)
                    setCourseError('')
                  }}
                  className={cn(
                    'rounded-[24px] border p-4 text-left transition',
                    isActive
                      ? 'border-[#7c3aed] bg-[#faf7ff]'
                      : 'border-[#e6dbff] bg-white hover:border-[#c4b5fd]'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <SelectionDot active={isActive} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{course.title}</p>
                      {course.description && (
                        <p className="mt-1 text-xs leading-5 text-slate-500">{course.description}</p>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}

            {customCourseOption && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCourseChoice(customCourseOption.key)
                  setCourseError('')
                }}
                className={cn(
                  'rounded-[24px] border p-4 text-left transition',
                  isCustomCourseSelected
                    ? 'border-[#7c3aed] bg-[#faf7ff]'
                    : 'border-[#e6dbff] bg-white hover:border-[#c4b5fd]'
                )}
              >
                <div className="flex items-start gap-3">
                  <SelectionDot active={isCustomCourseSelected} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{customCourseOption.title}</p>
                  </div>
                </div>
              </button>
            )}
          </div>

          {isCustomCourseSelected && (
            <InputField
              label="Exam name"
              value={customCourseTitle}
              onChange={(value) => {
                setCustomCourseTitle(value)
                setCourseError('')
              }}
              disabled={courseLoading}
            />
          )}

          {courseError && <MessageBanner tone="danger">{courseError}</MessageBanner>}

          <div className="grid gap-3">
            <button
              type="button"
              onClick={handleSaveCourseSelection}
              disabled={courseLoading}
              className="rounded-[18px] bg-[#6d28d9] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(109,40,217,0.20)] transition hover:bg-[#5b21b6] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {courseLoading ? 'Saving your course...' : 'Continue to plans'}
            </button>

            <button
              type="button"
              onClick={() => {
                tokenStore.clear()
                openOtpScreen('Sign in with a different phone number.')
              }}
              className="rounded-[18px] border border-[#e6dbff] bg-white px-4 py-3.5 text-sm font-semibold text-[#6d28d9] transition hover:border-[#6d28d9]"
            >
              Use another phone number
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-7">
        {groupedPlans.length > 1 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7c3aed]">Course</p>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {groupedPlans.map((group) => {
                const isActive = group.course.courseId === activeGroup?.course.courseId

                return (
                  <button
                    key={group.course.courseId}
                    type="button"
                    onClick={() => handleSelectCourseGroup(group.course.courseId)}
                    disabled={!canSelectPlan}
                    className={cn(
                      'shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition',
                      isActive
                        ? 'border-[#6d28d9] bg-[#6d28d9] text-white shadow-[0_14px_24px_rgba(109,40,217,0.18)]'
                        : 'border-[#e6dbff] bg-white text-slate-600 hover:border-[#c4b5fd] hover:text-[#6d28d9]',
                      !canSelectPlan && 'cursor-not-allowed opacity-70'
                    )}
                  >
                    {group.course.title}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {result && screen !== 'success' && (
          <div
            className={cn(
              'rounded-[24px] border px-4 py-4',
              result.tone === 'success' && 'border-emerald-200 bg-emerald-50',
              result.tone === 'warning' && 'border-amber-200 bg-amber-50',
              result.tone === 'danger' && 'border-rose-200 bg-rose-50'
            )}
          >
            <p
              className={cn(
                'text-sm font-semibold',
                result.tone === 'success' && 'text-emerald-900',
                result.tone === 'warning' && 'text-amber-900',
                result.tone === 'danger' && 'text-rose-900'
              )}
            >
              {result.title}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{result.message}</p>
            {result.returnUrl && (
              <button
                type="button"
                onClick={() => handleReturnToApp(screen === 'pending' ? 'pending' : 'failed')}
                className="mt-3 inline-flex items-center rounded-full border border-white/80 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300"
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
              className="rounded-[18px] bg-[#6d28d9] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(109,40,217,0.20)] transition hover:bg-[#5b21b6]"
            >
              Retry
            </button>
            <a
              href="/payment/error?code=HANDOFF_INVALID"
              className="rounded-[18px] border border-[#e6dbff] bg-white px-4 py-3.5 text-center text-sm font-semibold text-[#6d28d9] transition hover:border-[#6d28d9]"
            >
              Open help
            </a>
          </div>
        )}

        {activePlans.length > 0 && (
          <div className="space-y-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7c3aed]">
                Plans
              </p>
              <h2 className="mt-2 text-[1.75rem] font-semibold tracking-[-0.02em] text-slate-950">
                Select your pass
              </h2>
            </div>

            <div className="space-y-6">
              {activePlans.map((plan) => {
                const metrics = getPlanMetrics(plan, basePlan)
                const tag = getPlanTag(plan, popularPlanId)

                return (
                  <PlanOptionCard
                    key={plan.planId}
                    plan={plan}
                    metrics={metrics}
                    active={selectedPlanId === plan.planId}
                    disabled={!canSelectPlan}
                    pricing={selectedPlanId === plan.planId ? checkoutPricing : null}
                    tag={tag}
                    onSelect={() => setSelectedPlanId(plan.planId)}
                  />
                )
              })}
            </div>

            {selectedPlan && checkoutPricing && (
              <CouponSection
                appliedCode={activeCouponCode}
                couponCode={couponCode}
                disabled={!canSelectPlan || couponLoading}
                error={couponError}
                loading={couponLoading}
                message={couponMessage}
                pricing={checkoutPricing}
                onApply={handleApplyCoupon}
                onChange={(value) => {
                  setCouponCode(normalizeCouponInput(value))
                  setCouponError('')
                  setCouponMessage('')
                }}
                onRemove={handleRemoveCoupon}
              />
            )}
          </div>
        )}
      </div>
    )
  }

  function renderFooterAction() {
    const checkoutAction = getCheckoutActionState()

    if (!checkoutAction) {
      return null
    }

    return (
      <div className="sticky bottom-0 -mx-4 mt-8 border-t border-[#e6dbff] bg-white/95 px-4 pb-4 pt-4 backdrop-blur sm:mx-0 sm:rounded-t-[28px] sm:border-x">
        <CheckoutButton
          action={checkoutAction}
          className="w-full"
        />

        <p className="mt-3 text-center text-[11px] font-medium text-slate-500">
          Razorpay secure checkout
        </p>
      </div>
    )
  }

  const heroTitle =
    screen === 'otp'
      ? 'Sign in to continue'
      : screen === 'course'
        ? 'Choose your exam'
        : 'Payment'

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

      <div className="min-h-screen bg-[linear-gradient(180deg,#f7f0ff_0%,#ffffff_42%,#f8fafc_100%)] px-4 py-5 text-slate-900 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-[520px]">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-[#e6dbff] bg-white px-3 text-xs font-semibold text-[#6d28d9] shadow-[0_10px_24px_rgba(109,40,217,0.06)] transition hover:border-[#6d28d9]"
            >
              <ChevronLeftIcon className="h-3.5 w-3.5" />
              Back
            </button>

            <div className="min-w-0 rounded-full border border-[#e6dbff] bg-white px-3 py-2 text-[11px] font-semibold text-[#6d28d9] shadow-[0_10px_24px_rgba(109,40,217,0.06)]">
              <span className="block truncate">
                {selectedCoursePreview?.title || activeGroup?.course.title || 'Virtual Library'}
              </span>
            </div>
          </div>

          <div className="mt-9">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#7c3aed]">
              Secure checkout
            </p>
            <h1 className="mt-3 text-[2.25rem] font-semibold leading-none tracking-[-0.02em] text-slate-950">
              {heroTitle}
            </h1>
          </div>

          <main className="mt-9">
            {renderBodyContent()}
          </main>

          {renderFooterAction()}

          <div className="mt-5 flex flex-wrap justify-center gap-4 pb-2 text-[11px] font-medium text-slate-500">
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
        helperText={
          result?.returnUrl
            ? 'Close this modal to continue back into the app.'
            : shouldUseV2WebFallback
              ? 'Open the next page for app download options, included features, and access steps.'
              : 'Close this modal to stay on the checkout page.'
        }
        buttonLabel={
          result?.returnUrl
            ? 'Close and continue'
            : shouldUseV2WebFallback
              ? 'Open access page'
              : 'Close'
        }
        onClose={handleCloseSuccessModal}
      />
    </>
  )
}

function CouponSection({
  appliedCode,
  couponCode,
  disabled,
  error,
  loading,
  message,
  onApply,
  onChange,
  onRemove,
  pricing,
}: {
  appliedCode: string
  couponCode: string
  disabled: boolean
  error: string
  loading: boolean
  message: string
  onApply: () => void
  onChange: (value: string) => void
  onRemove: () => void
  pricing: BillingPricing
}) {
  const hasAppliedCoupon = Boolean(appliedCode)
  const canApply = Boolean(couponCode.trim()) && !disabled && !hasAppliedCoupon

  return (
    <section className="rounded-[24px] border border-[#e6dbff] bg-white px-4 py-4 shadow-[0_14px_30px_rgba(109,40,217,0.06)]">
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault()

          if (canApply) {
            onApply()
          }
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="mb-2 block text-sm font-medium text-slate-700">Coupon code</span>
          <input
            type="text"
            value={couponCode}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled || hasAppliedCoupon}
            className="h-12 w-full rounded-[16px] border border-[#ddd0ff] bg-[#faf7ff] px-4 text-sm font-semibold uppercase tracking-[0.08em] text-slate-900 outline-none transition focus:border-[#7c3aed] focus:bg-white disabled:cursor-not-allowed disabled:opacity-70"
            autoComplete="off"
          />
        </label>

        <button
          type="submit"
          disabled={!canApply || loading}
          className="h-12 shrink-0 rounded-[16px] bg-[#6d28d9] px-4 text-sm font-semibold text-white shadow-[0_14px_26px_rgba(109,40,217,0.18)] transition hover:bg-[#5b21b6] disabled:cursor-not-allowed disabled:opacity-55"
        >
          {loading ? 'Applying...' : 'Apply'}
        </button>
      </form>

      {hasAppliedCoupon && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-[18px] border border-emerald-200 bg-emerald-50 px-3 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-emerald-900">{appliedCode}</p>
            {message && <p className="mt-0.5 text-xs text-emerald-700">{message}</p>}
          </div>

          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:border-emerald-400"
          >
            Remove
          </button>
        </div>
      )}

      {!hasAppliedCoupon && error && <p className="mt-3 text-xs font-medium text-rose-600">{error}</p>}
      {!hasAppliedCoupon && !error && message && <p className="mt-3 text-xs font-medium text-emerald-700">{message}</p>}

      <div className="mt-5 space-y-2 border-t border-[#f0e8ff] pt-4">
        <PriceLine label="Subtotal" value={formatCurrency(pricing.baseAmountPaise, pricing.currency)} />
        {pricing.discountAmountPaise > 0 && (
          <PriceLine
            label="Discount"
            value={`-${formatCurrency(pricing.discountAmountPaise, pricing.currency)}`}
            tone="success"
          />
        )}
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm font-semibold text-slate-950">Total</span>
          <span className="text-xl font-bold tracking-[-0.03em] text-slate-950">
            {formatCurrency(pricing.finalAmountPaise, pricing.currency)}
          </span>
        </div>
      </div>
    </section>
  )
}

function PriceLine({
  label,
  tone,
  value,
}: {
  label: string
  tone?: 'success'
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={cn('font-semibold text-slate-700', tone === 'success' && 'text-emerald-700')}>
        {value}
      </span>
    </div>
  )
}

function PlanOptionCard({
  active,
  disabled,
  metrics,
  onSelect,
  plan,
  pricing,
  tag,
}: {
  active: boolean
  disabled: boolean
  metrics: PlanMetrics
  onSelect: () => void
  plan: BillingPlan
  pricing: BillingPricing | null
  tag: string | null
}) {
  const displayAmountPaise = pricing?.finalAmountPaise ?? plan.amountPaise
  const displayCurrency = pricing?.currency || plan.currency
  const compareAmount = pricing && pricing.discountAmountPaise > 0
    ? pricing.baseAmountPaise
    : metrics.compareAmountPaise
  const priceDrop = compareAmount ? compareAmount - displayAmountPaise : 0

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'relative w-full rounded-[28px] border px-5 py-6 text-left transition sm:px-6',
        active
          ? 'border-[#7c3aed] bg-[#f4eeff] shadow-[0_18px_36px_rgba(109,40,217,0.12)]'
          : 'border-[#e6dbff] bg-white hover:border-[#c4b5fd]',
        disabled && 'cursor-not-allowed opacity-75'
      )}
    >
      {tag && (
        <span className="absolute right-5 top-0 -translate-y-1/2 rounded-lg bg-[#7c3aed] px-4 py-2 text-xs font-bold text-white shadow-[0_10px_24px_rgba(109,40,217,0.18)]">
          {tag}
        </span>
      )}

      <div className="flex items-center justify-between gap-5">
        <div className="min-w-0">
          <p className="text-[1.35rem] font-semibold leading-tight tracking-[-0.01em] text-slate-950 sm:text-[1.55rem]">
            {formatPlanTitle(plan)}
          </p>
          <p className="mt-4 text-sm font-medium text-slate-500">
            Valid for {getPlanValidityDays(plan.durationMonths)} Days
          </p>
          {priceDrop > 0 && (
            <p className="mt-4 text-base font-semibold text-[#1f8f56]">
              Price drop {formatCurrency(priceDrop, displayCurrency)}
            </p>
          )}
        </div>

        <div className="shrink-0 text-right">
          {compareAmount && compareAmount > displayAmountPaise && (
            <p className="text-base font-medium text-slate-400 line-through decoration-slate-400">
              {formatCurrency(compareAmount, displayCurrency)}
            </p>
          )}
          <p className="mt-4 text-[2.05rem] font-bold leading-none tracking-[-0.03em] text-slate-950">
            {formatCurrency(displayAmountPaise, displayCurrency)}
          </p>
        </div>
      </div>
    </button>
  )
}

function CheckoutButton({
  action,
  className,
}: {
  action: CheckoutActionState
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      className={cn(
        'flex items-center justify-center gap-2 rounded-[18px] bg-[linear-gradient(90deg,#6d28d9,#8b5cf6)] px-4 py-4 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(109,40,217,0.24)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
    >
      <span>{action.label}</span>
      {action.showArrow && <ArrowRightIcon className="h-4 w-4" />}
    </button>
  )
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center">
      <div className="h-12 w-12 animate-spin rounded-full border-2 border-[#e6dbff] border-t-[#6d28d9]" />
      <p className="mt-5 text-sm font-medium text-slate-500">{label}</p>
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
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7c3aed]">{eyebrow}</p>
      <h2 className="mt-2 text-[1.45rem] font-semibold tracking-[-0.02em] text-slate-950">{title}</h2>
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
  placeholder?: string
  value: string
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <div className="flex items-center rounded-[18px] border border-[#ddd0ff] bg-white px-4 shadow-[0_12px_24px_rgba(109,40,217,0.06)]">
        {hint && <span className="mr-3 text-sm font-semibold text-slate-400">{hint}</span>}
        <input
          type="text"
          inputMode={inputMode}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder || undefined}
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
        active ? 'border-[#7c3aed] bg-[#7c3aed]' : 'border-[#d8ccff] bg-white'
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

function SuccessCompletionModal({
  isOpen,
  message,
  helperText,
  buttonLabel,
  onClose,
}: {
  isOpen: boolean
  message?: string
  helperText: string
  buttonLabel: string
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
      <div className="w-full max-w-sm rounded-[32px] bg-white p-6 text-center shadow-[0_34px_80px_rgba(76,29,149,0.20)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f4eeff] text-[#6d28d9]">
          <CheckIcon className="h-7 w-7" />
        </div>

        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7c3aed]">
          Payment Completed
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-slate-950">
          Your access is ready
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          {message || 'Payment confirmed successfully.'}
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {helperText}
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-[18px] bg-[#6d28d9] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(109,40,217,0.22)] transition hover:bg-[#5b21b6]"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  )
}

function getCheckoutPricing(plan: BillingPlan | null, quote: BillingQuoteResponse | null): BillingPricing | null {
  if (!plan) {
    return null
  }

  if (quote?.pricing) {
    return quote.pricing
  }

  return {
    baseAmountPaise: plan.amountPaise,
    discountAmountPaise: 0,
    finalAmountPaise: plan.amountPaise,
    currency: plan.currency,
  }
}

function normalizeCouponInput(value: string) {
  return value.replace(/\s/g, '').toUpperCase().slice(0, 64)
}

function getPlanMetrics(plan: BillingPlan, basePlan: BillingPlan | null): PlanMetrics {
  const safeDuration = Math.max(plan.durationMonths, 1)
  const explicitCompareAmount = getExplicitCompareAmount(plan)

  if (explicitCompareAmount && explicitCompareAmount > plan.amountPaise) {
    return {
      compareAmountPaise: explicitCompareAmount,
    }
  }

  if (!basePlan) {
    return {
      compareAmountPaise: null,
    }
  }

  const baseMonthlyPaise = Math.round(basePlan.amountPaise / Math.max(basePlan.durationMonths, 1))
  const compareAmountPaise = baseMonthlyPaise * safeDuration

  return {
    compareAmountPaise: compareAmountPaise > plan.amountPaise ? compareAmountPaise : null,
  }
}

function getExplicitCompareAmount(plan: BillingPlan) {
  const rawPlan = plan as BillingPlan & {
    compareAmountPaise?: number | null
    originalAmountPaise?: number | null
    mrpAmountPaise?: number | null
  }

  return rawPlan.compareAmountPaise || rawPlan.originalAmountPaise || rawPlan.mrpAmountPaise || null
}

function getPlanTag(plan: BillingPlan, popularPlanId: string) {
  if (plan.planId === popularPlanId) {
    return 'Recommended'
  }

  return null
}

function getDefaultPlanId(plans: BillingPlan[], requestedPlanId?: string) {
  if (!plans.length) {
    return ''
  }

  if (requestedPlanId && plans.some((plan) => plan.planId === requestedPlanId)) {
    return requestedPlanId
  }

  return (
    plans.find((plan) => plan.durationMonths === 12)?.planId ||
    plans.find((plan) => plan.durationMonths === 6)?.planId ||
    plans[Math.min(1, plans.length - 1)]?.planId ||
    plans[0]?.planId ||
    ''
  )
}

function formatPlanDuration(durationMonths: number) {
  return `${durationMonths} ${durationMonths === 1 ? 'Month' : 'Months'}`
}

function formatPlanTitle(plan: BillingPlan) {
  if (plan.name?.trim()) {
    return plan.name.trim()
  }

  if (plan.durationMonths === 1) {
    return 'Monthly Pass'
  }

  if (plan.durationMonths === 12) {
    return 'Yearly Pass'
  }

  return `${formatPlanDuration(plan.durationMonths)} Pass`
}

function getPlanValidityDays(durationMonths: number) {
  if (durationMonths === 1) {
    return 31
  }

  return Math.round((durationMonths * 365) / 12)
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
