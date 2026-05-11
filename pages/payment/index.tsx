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
  CheckoutOtpVerifyResponse,
  CourseOptionsResponse,
  CourseSummary,
  extractAccessToken,
  extractRefreshToken,
  formatCurrency,
  hasGrantedCourseAccess,
  normalizeIndianPhone,
  PaymentApiError,
  PaymentLinkCreateResponse,
  PaymentLinkStatusResponse,
  postMobileEvent,
  PublicBillingPlansResponse,
  requestOtp,
  tokenStore,
  verifyOtp,
} from '@/lib/payment-client'
import {
  getPricingPlanMeta,
  PricingPlanCard,
} from '@/components/v2/PricingPlanCard'

type ScreenState =
  | 'booting'
  | 'planSelect'
  | 'otp'
  | 'course'
  | 'ready'
  | 'processing'
  | 'pending'
  | 'accountSetup'
  | 'success'
  | 'failed'
  | 'error'
type AuthMode = 'unknown' | 'cookie' | 'bearer' | 'unauthenticated'
type AccountSetupStep = 'profile' | 'course'
type AccountGender = 'FEMALE' | 'MALE' | 'NON_BINARY' | 'OTHER' | 'PREFER_NOT_TO_SAY' | ''

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

type BillingDetails = {
  email: string
}

type PaymentSessionUser = {
  email?: string
  name?: string
  phoneE164?: string
}

type PaymentLinkCustomerPayload = {
  email?: string
  name?: string
  phoneE164?: string
}

const EMPTY_BILLING_DETAILS: BillingDetails = {
  email: '',
}

const CHECKOUT_PAYMENT_ORDER_ID_KEY = 'checkoutPaymentOrderId'
const CHECKOUT_CLAIM_TOKEN_KEY = 'checkoutClaimToken'
const CHECKOUT_PHONE_KEY = 'checkoutPhoneE164'
const CHECKOUT_EMAIL_KEY = 'checkoutEmail'
const CHECKOUT_ACCOUNT_EXISTS_KEY = 'checkoutAccountExists'
const CHECKOUT_SESSION_USER_KEY = 'checkoutSessionUser'
const LEGACY_PAYMENT_ORDER_ID_KEY = 'lastPaymentOrderId'
const GOOGLE_PLAY_HREF = 'https://play.google.com/store/apps/details?id=com.pushkardev123.VirtualLibrary'
const APP_STORE_HREF = 'https://apps.apple.com/'

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
  const [billingDetails, setBillingDetails] = useState<BillingDetails>(EMPTY_BILLING_DETAILS)
  const [sessionUser, setSessionUser] = useState<PaymentSessionUser | null>(null)
  const [billingError, setBillingError] = useState('')
  const [paymentPhoneOtpRequired, setPaymentPhoneOtpRequired] = useState(false)
  const [paymentOrderId, setPaymentOrderId] = useState('')
  const [statusTimedOut, setStatusTimedOut] = useState(false)
  const [accountSetupStep, setAccountSetupStep] = useState<AccountSetupStep>('profile')
  const [accountSetupLoading, setAccountSetupLoading] = useState(false)
  const [accountOtpStarted, setAccountOtpStarted] = useState(false)
  const [accountOtp, setAccountOtp] = useState('')
  const [accountName, setAccountName] = useState('')
  const [accountAge, setAccountAge] = useState('')
  const [accountGender, setAccountGender] = useState<AccountGender>('')
  const [accountTermsAccepted, setAccountTermsAccepted] = useState(false)
  const [accountError, setAccountError] = useState('')
  const [privacyPolicyVersion] = useState('')

  const planIdFromQuery = getQueryParam(router.query.planId)
  const paymentStatusFromQuery = getQueryParam(router.query.paymentStatus)
  const checkoutSource = getQueryParam(router.query.source)
  const checkoutMode = getQueryParam(router.query.mode)
  const isLegacyCheckoutFlow = checkoutMode === 'legacy'
  const isPrimaryPaymentLinksFlow = !isLegacyCheckoutFlow && Boolean(planIdFromQuery || paymentStatusFromQuery)
  const shouldUseV2WebFallback = checkoutSource === 'v2-neet-pg'
  const shouldLoadCheckoutScript = router.isReady && isLegacyCheckoutFlow
  const isSessionPaymentLinkCheckout = isPrimaryPaymentLinksFlow && Boolean(sessionUser)

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
  }, [router.isReady, router.asPath])

  useEffect(() => {
    if (!activeGroup?.plans.length) {
      return
    }

    const hasSelectedPlan = activeGroup.plans.some((plan) => plan.planId === selectedPlanId)

    if (!hasSelectedPlan) {
      setSelectedPlanId(
        getDefaultPlanId(
          activeGroup.plans,
          isPrimaryPaymentLinksFlow ? planIdFromQuery : undefined,
          isPrimaryPaymentLinksFlow ? null : getQueryNumber(router.query.durationMonths)
        )
      )
    }
  }, [activeGroup, isPrimaryPaymentLinksFlow, planIdFromQuery, router.query.durationMonths, selectedPlanId])

  useEffect(() => {
    selectedPlanIdRef.current = selectedPlanId
  }, [selectedPlanId])

  useEffect(() => {
    setCouponCode('')
    setAppliedCouponCode('')
    setCouponQuote(null)
    setCouponMessage('')
    setCouponError('')
    setPaymentPhoneOtpRequired(false)
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
    setPaymentPhoneOtpRequired(false)
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

  function updateBillingField(field: keyof BillingDetails, value: string) {
    setBillingDetails((current) => ({
      ...current,
      [field]: value,
    }))
    setBillingError('')
  }

  function getGuestContactPayload() {
    const validationError = validateBillingDetails(billingDetails, phone)

    if (validationError) {
      setBillingError(validationError)
      return null
    }

    try {
      const normalizedPhone = normalizeIndianPhone(phone)

      return {
        phoneE164: normalizedPhone.e164,
        email: billingDetails.email.trim().toLowerCase(),
      }
    } catch (error) {
      setBillingError(getErrorMessage(error, 'Enter a valid mobile number.'))
      return null
    }
  }

  function getPaymentLinkCustomerPayload(): PaymentLinkCustomerPayload | null {
    if (sessionUser) {
      return {}
    }

    return getGuestContactPayload()
  }

  async function loadSessionUser() {
    try {
      const response = await apiFetch<any>('/me', {
        headers: {
          Accept: 'application/json',
        },
      })
      const user = extractSessionUser(response)

      setSessionUser(user)
      if (user) {
        setAuthMode(tokenStore.getAccessToken() ? 'bearer' : 'cookie')
      }

      return user
    } catch {
      setSessionUser(null)
      return null
    }
  }

  async function bootstrap() {
    setPageError('')
    setAuthError('')
    setCourseError('')
    setStatusNote('Loading payment options...')
    setResult(null)
    setStatusTimedOut(false)
    setPaymentOrderId('')
    setAccountSetupStep('profile')
    setAccountError('')
    setSessionUser(null)
    setAuthMode(tokenStore.getAccessToken() ? 'bearer' : 'unknown')

    if (paymentStatusFromQuery) {
      await handlePaymentLinkResult(paymentStatusFromQuery)
      return
    }

    if (planIdFromQuery) {
      await loadPublicPlanForPayment(planIdFromQuery)
      return
    }

    const storedCheckoutSession = getStoredCheckoutSession()
    const orderIdFromQuery = getQueryParam(router.query.orderId)
    const checkoutOrderId = orderIdFromQuery || storedCheckoutSession.orderId

    if (checkoutOrderId && storedCheckoutSession.claimToken) {
      setPaymentOrderId(checkoutOrderId)
      setScreen('pending')
      setResult({
        title: 'Checking payment',
        message: 'We are checking your Razorpay payment status.',
        tone: 'warning',
      })
      await checkPaymentLinkStatus(checkoutOrderId, true)
      return
    }

    if (isLegacyCheckoutFlow) {
      await loadPlans()
      return
    }

    await loadPublicPlansForSelection()
  }

  async function loadPublicPlansForSelection() {
    try {
      setScreen('booting')
      const [data, user] = await Promise.all([
        apiFetch<PublicBillingPlansResponse>('/billing/plans/public', {
          skipAuth: true,
          headers: {
            Accept: 'application/json',
          },
        }),
        loadSessionUser(),
      ])
      const availablePlans = [...(data.plans || [])].sort((left, right) => {
        if ((left.course.displayOrder || 0) !== (right.course.displayOrder || 0)) {
          return (left.course.displayOrder || 0) - (right.course.displayOrder || 0)
        }

        if (left.durationMonths !== right.durationMonths) {
          return left.durationMonths - right.durationMonths
        }

        return left.amountPaise - right.amountPaise
      })

      if (!availablePlans.length) {
        setPlans([])
        setSelectedPlanId('')
        setSelectedCourse(data.course || null)
        setScreen('error')
        setPageError(data.message || 'No plans are available right now. Please try again shortly.')
        return
      }

      setPlans(availablePlans)
      setSelectedCourse(data.course || availablePlans[0]?.course || null)
      setSelectedPlanId(getDefaultPlanId(availablePlans))
      setAuthMode(user ? (tokenStore.getAccessToken() ? 'bearer' : 'cookie') : 'unauthenticated')
      setScreen('planSelect')
      setStatusNote('Choose a plan to continue to payment.')
    } catch (error) {
      setScreen('error')
      setPageError(getErrorMessage(error, 'Unable to load plans. Please try again.'))
    }
  }

  async function loadPublicPlanForPayment(requestedPlanId: string) {
    try {
      setScreen('booting')
      const [data, user] = await Promise.all([
        apiFetch<PublicBillingPlansResponse>('/billing/plans/public', {
          skipAuth: true,
          headers: {
            Accept: 'application/json',
          },
        }),
        loadSessionUser(),
      ])
      const availablePlans = [...(data.plans || [])].sort((left, right) => {
        if (left.durationMonths !== right.durationMonths) {
          return left.durationMonths - right.durationMonths
        }

        return left.amountPaise - right.amountPaise
      })
      const matchingPlan = availablePlans.find((plan) => plan.planId === requestedPlanId)

      if (!availablePlans.length || !matchingPlan) {
        setPlans(availablePlans)
        setSelectedPlanId('')
        setSelectedCourse(data.course || availablePlans[0]?.course || null)
        setScreen('error')
        setPageError('Selected plan is no longer available. Please return to pricing and choose again.')
        return
      }

      setPlans(availablePlans)
      setSelectedCourse(data.course || matchingPlan.course)
      setSelectedPlanId(matchingPlan.planId)
      setAuthMode(user ? (tokenStore.getAccessToken() ? 'bearer' : 'cookie') : 'unauthenticated')
      setScreen('ready')
      setStatusNote(user ? 'Review your plan and apply a coupon if you have one.' : 'Enter contact details to create your Razorpay payment link.')
    } catch (error) {
      setScreen('error')
      setPageError(getErrorMessage(error, 'Unable to load selected plan. Please try again.'))
    }
  }

  async function loadPlans() {
    try {
      setScreen('booting')
      const planIdFromQuery = getQueryParam(router.query.planId)
      const durationMonthsFromQuery = getQueryNumber(router.query.durationMonths)
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
      setSelectedPlanId(getDefaultPlanId(availablePlans, planIdFromQuery, durationMonthsFromQuery))
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
    const storedCheckoutSession = getStoredCheckoutSession()

    if (storedCheckoutSession.orderId && storedCheckoutSession.claimToken) {
      setPaymentOrderId(storedCheckoutSession.orderId)
      setScreen('pending')
      setResult({
        title: 'Checking payment',
        message: 'We are checking your Razorpay payment status.',
        tone: 'warning',
      })
      await checkPaymentLinkStatus(storedCheckoutSession.orderId, true)
      return
    }

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
      if (isPrimaryPaymentLinksFlow && planIdFromQuery) {
        setScreen('ready')
        setOtpRequested(false)
        setOtp('')
        setStatusNote('Mobile verified. Complete billing to continue.')
        return
      }

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

      if (accountSetupStep === 'course') {
        await Promise.allSettled([
          apiFetch('/me'),
          apiFetch('/me/courses'),
        ])
        setScreen('success')
        setShowSuccessModal(true)
        setResult({
          title: 'Access unlocked',
          message: 'Your account is ready and course access is active.',
          tone: 'success',
        })
        setStatusNote('Account setup completed successfully.')
        postMobileEvent('PAYMENT_SUCCESS', {
          status: 'success',
          courseId: selectedCourseChoice === customCourseOption?.key ? undefined : selectedCourseChoice,
        })
        return
      }

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

    if (!selectedPlan) {
      setCouponError('Select a plan before applying a coupon.')
      return
    }

    if (!nextCouponCode) {
      setCouponError('Enter a coupon code to apply.')
      return
    }

    const customerPayload = isPrimaryPaymentLinksFlow ? getPaymentLinkCustomerPayload() : null

    if (isPrimaryPaymentLinksFlow && !customerPayload) {
      return
    }

    if (!isPrimaryPaymentLinksFlow && !ensureAuthorization('Sign in with your phone number to apply a coupon.')) {
      return
    }

    setCouponLoading(true)
    setCouponError('')
    setCouponMessage('')
    setPageError('')

    try {
      const requestPlanId = selectedPlan.planId
      const quoteEndpoint = isPrimaryPaymentLinksFlow ? '/billing/guest/payment-links/quote' : '/billing/quote'
      const quote = await apiFetch<BillingQuoteResponse>(quoteEndpoint, {
        method: 'POST',
        skipAuth: isPrimaryPaymentLinksFlow && !sessionUser,
        body: JSON.stringify({
          planId: requestPlanId,
          ...(customerPayload || {}),
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
      if (!isPrimaryPaymentLinksFlow && error instanceof PaymentApiError && error.status === 401) {
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
    if (!selectedPlan) {
      setPageError('Select a plan before continuing.')
      return
    }

    if (isPrimaryPaymentLinksFlow) {
      await createPaymentLink()
      return
    }

    const validationError = validateBillingDetails(billingDetails, phone)

    if (validationError) {
      setBillingError(validationError)
      return
    }

    if (!ensureAuthorization('Sign in with your phone number to continue to payment.')) {
      return
    }

    if (paymentPhoneOtpRequired && otp.trim().length < 4) {
      setAuthError('Enter the OTP sent to your phone to continue.')
      return
    }

    setCheckoutLoading(true)
    setPageError('')
    setBillingError('')
    setResult(null)
    setStatusNote('Creating your Razorpay payment link...')

    try {
      const order = await apiFetch<BillingOrderResponse>('/billing/orders', {
        method: 'POST',
        body: JSON.stringify({
          planId: selectedPlan.planId,
          couponCode: getCouponCodeForSubmit(couponCode),
        }),
      })

      openPaymentDestination(order)
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

  async function createPaymentLink() {
    if (!selectedPlan) {
      setPageError('Select a plan before continuing.')
      return
    }

    const customerPayload = getPaymentLinkCustomerPayload()

    if (!customerPayload) {
      return
    }

    setCheckoutLoading(true)
    setPageError('')
    setAuthError('')
    setBillingError('')
    setResult(null)
    setStatusTimedOut(false)
    setStatusNote('Creating your Razorpay payment link...')

    try {
      const created = await apiFetch<PaymentLinkCreateResponse>('/billing/guest/payment-links', {
        method: 'POST',
        skipAuth: !sessionUser,
        body: JSON.stringify({
          planId: selectedPlan.planId,
          ...customerPayload,
          couponCode: getCouponCodeForSubmit(couponCode),
        }),
      })
      const paymentUrl = getPaymentLinkUrl(created)

      if (!paymentUrl) {
        setPageError('Backend did not return a Razorpay payment link. Please try again.')
        setCheckoutLoading(false)
        return
      }

      if (!created.order?.id || !created.checkout?.claimToken) {
        setPageError('Checkout session is incomplete. Please retry payment from pricing.')
        setCheckoutLoading(false)
        return
      }

      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(CHECKOUT_PAYMENT_ORDER_ID_KEY, created.order.id)
        window.sessionStorage.setItem(CHECKOUT_CLAIM_TOKEN_KEY, created.checkout.claimToken)
        window.sessionStorage.setItem(CHECKOUT_PHONE_KEY, sessionUser?.phoneE164 || customerPayload.phoneE164 || '')
        window.sessionStorage.setItem(CHECKOUT_EMAIL_KEY, sessionUser?.email || customerPayload.email || '')
        window.sessionStorage.setItem(
          CHECKOUT_ACCOUNT_EXISTS_KEY,
          Boolean(created.customer?.accountExists || sessionUser) ? '1' : '0'
        )
        window.sessionStorage.setItem(CHECKOUT_SESSION_USER_KEY, sessionUser ? '1' : '0')
      }

      postMobileEvent('OPEN_PAYMENT_LINK', {
        planId: selectedPlan.planId,
        orderId: created.order?.id,
        paymentLink: paymentUrl,
      })
      window.location.assign(paymentUrl)
    } catch (error) {
      const errorCode = getPaymentErrorCode(error)

      if (error instanceof PaymentApiError && error.status === 404) {
        setPageError('Selected plan is no longer available. Please return to pricing and choose again.')
        if (planIdFromQuery) {
          void loadPublicPlanForPayment(planIdFromQuery)
        }
        setCheckoutLoading(false)
        return
      }

      if (errorCode === 'EMAIL_ALREADY_IN_USE') {
        setPageError('This email already has an account. Use that account or choose another email.')
        setCheckoutLoading(false)
        return
      }

      if (errorCode === 'PHONE_EMAIL_MISMATCH') {
        setPageError('This phone number is linked to another email. Use the existing email for this phone.')
        setCheckoutLoading(false)
        return
      }

      if (errorCode?.startsWith('COUPON_')) {
        setCouponError(getErrorMessage(error, 'Coupon is not valid for this plan.'))
        setCheckoutLoading(false)
        return
      }

      setPageError(
        errorCode === 'PAYMENT_LINK_CREATE_FAILED'
          ? 'Could not create the Razorpay payment link. Please retry.'
          : getErrorMessage(error, 'Could not create the payment link. Please try again.')
      )
      setCheckoutLoading(false)
      setStatusNote('Payment link creation failed.')
    }
  }

  function openPaymentDestination(order: BillingOrderResponse) {
    const paymentLink = getDirectPaymentLink(order)

    if (paymentLink && typeof window !== 'undefined') {
      setStatusNote('Opening Razorpay payment page...')
      postMobileEvent('OPEN_PAYMENT_LINK', {
        planId: order.plan?.planId,
        orderId: order.order?.id || order.orderId,
        paymentLink,
      })
      window.location.assign(paymentLink)
      return
    }

    if (!razorpayReady || typeof window === 'undefined' || !window.Razorpay) {
      setPageError('Payment link was not returned and Razorpay Checkout is still loading. Please try again in a moment.')
      setCheckoutLoading(false)
      return
    }

    openRazorpayCheckout(order)
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
        color: '#6b21a8',
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

  async function handlePaymentLinkResult(paymentStatus: string) {
    const normalizedStatus = paymentStatus.toLowerCase()
    const storedCheckoutSession = getStoredCheckoutSession()
    const orderIdFromQuery = getQueryParam(router.query.orderId)
    const storedOrderId = typeof window !== 'undefined'
      ? storedCheckoutSession.orderId || window.sessionStorage.getItem(LEGACY_PAYMENT_ORDER_ID_KEY) || ''
      : ''
    const nextPaymentOrderId = orderIdFromQuery || storedOrderId

    setPaymentOrderId(nextPaymentOrderId)
    setCheckoutLoading(false)
    setStatusTimedOut(false)

    if (storedCheckoutSession.claimToken && !storedCheckoutSession.sessionUser && (normalizedStatus === 'success' || normalizedStatus === 'captured')) {
      setScreen('pending')
      setResult({
        title: 'Checking payment',
        message: 'Payment succeeded. We are preparing account setup.',
        tone: 'warning',
      })

      if (nextPaymentOrderId) {
        await checkPaymentLinkStatus(nextPaymentOrderId, true)
        return
      }

      await openAccountSetup(nextPaymentOrderId)
      return
    }

    if (normalizedStatus === 'account_setup_required') {
      await openAccountSetup(nextPaymentOrderId)
      return
    }

    if (normalizedStatus === 'success') {
      await Promise.allSettled([
        apiFetch('/me/courses'),
        apiFetch('/me'),
      ])
      if (storedCheckoutSession.sessionUser) {
        clearStoredCheckoutSession()
      }

      setScreen('success')
      setShowSuccessModal(true)
      setResult({
        title: 'Access unlocked',
        message: 'Payment confirmed successfully. Your course access is being refreshed.',
        tone: 'success',
      })
      setStatusNote('Payment completed successfully.')
      postMobileEvent('PAYMENT_SUCCESS', {
        status: 'success',
        orderId: nextPaymentOrderId,
      })
      return
    }

    if (normalizedStatus === 'pending') {
      setScreen('pending')
      setResult({
        title: 'Payment is being processed',
        message: nextPaymentOrderId
          ? 'Razorpay has returned a pending status. We are checking for final confirmation.'
          : 'Razorpay has returned a pending status. Use refresh after a moment if access is not active.',
        tone: 'warning',
      })
      setStatusNote('Waiting for final confirmation...')

      if (nextPaymentOrderId) {
        startPaymentLinkStatusPoll(nextPaymentOrderId)
      }
      return
    }

    setScreen('failed')
    setResult({
      title: 'Payment failed',
      message: 'Razorpay could not complete this payment. You can return to pricing and try again.',
      tone: 'danger',
    })
    setStatusNote('Payment failed.')
    postMobileEvent('PAYMENT_FAILED', {
      status: 'failed',
      orderId: nextPaymentOrderId,
    })
  }

  function startPaymentLinkStatusPoll(orderId: string) {
    if (pendingPollRef.current) {
      window.clearInterval(pendingPollRef.current)
    }

    let attempts = 0
    pendingPollRef.current = window.setInterval(() => {
      attempts += 1

      void checkPaymentLinkStatus(orderId, false)

      if (attempts >= 30 && pendingPollRef.current) {
        window.clearInterval(pendingPollRef.current)
        pendingPollRef.current = null
        setStatusTimedOut(true)
        setResult({
          title: 'Still checking payment',
          message: 'Confirmation is taking longer than usual. You can check again manually.',
          tone: 'warning',
        })
      }
    }, 2000)
  }

  async function checkPaymentLinkStatus(orderId: string, manual: boolean) {
    if (!orderId) {
      setPageError('Payment order id is missing. Please reopen checkout from pricing.')
      return
    }

    if (manual) {
      setStatusTimedOut(false)
      setStatusNote('Checking payment status...')
    }

    try {
      const storedCheckoutSession = getStoredCheckoutSession()
      const claimToken = getCheckoutClaimToken()
      if (isPrimaryPaymentLinksFlow && !claimToken) {
        setScreen('error')
        setPageError('Checkout session could not be verified. Please contact support with your payment id.')
        return
      }
      const status = claimToken
        ? await apiFetch<PaymentLinkStatusResponse>('/billing/guest/payment-links/status', {
          method: 'POST',
          skipAuth: true,
          body: JSON.stringify({
            paymentOrderId: orderId,
            claimToken,
          }),
        })
        : await apiFetch<PaymentLinkStatusResponse>(`/billing/payment-links/status/${orderId}`, {
          headers: {
            Accept: 'application/json',
          },
        })
      const normalizedOrderStatus = status.status?.toUpperCase()
      const normalizedPaymentStatus = status.paymentStatus?.toUpperCase()
      const isGuestCheckout = Boolean(claimToken)
      const captured = normalizedOrderStatus === 'CAPTURED' || normalizedPaymentStatus === 'CAPTURED'
      const needsAccountSetup =
        isGuestCheckout &&
        !status.accessGranted &&
        (normalizedOrderStatus === 'ACCOUNT_SETUP_REQUIRED' || status.accountSetupRequired || captured)
      const completed = status.accessGranted || (!isGuestCheckout && (normalizedOrderStatus === 'COMPLETED' || captured))
      const failed = normalizedOrderStatus === 'FAILED' || normalizedPaymentStatus === 'FAILED'

      if (needsAccountSetup) {
        if (pendingPollRef.current) {
          window.clearInterval(pendingPollRef.current)
          pendingPollRef.current = null
        }

        await openAccountSetup(orderId)
        return
      }

      if (completed) {
        if (pendingPollRef.current) {
          window.clearInterval(pendingPollRef.current)
          pendingPollRef.current = null
        }

        await Promise.allSettled([
          apiFetch('/me/courses'),
          apiFetch('/me'),
        ])
        if (storedCheckoutSession.sessionUser) {
          clearStoredCheckoutSession()
        }

        setScreen('success')
        setShowSuccessModal(true)
        setResult({
          title: 'Access unlocked',
          message: 'Payment confirmed successfully. Your course access is active.',
          tone: 'success',
        })
        setStatusNote('Payment completed successfully.')
        postMobileEvent('PAYMENT_SUCCESS', {
          status: 'success',
          orderId,
          providerPaymentId: status.order?.providerPaymentId,
        })
        return
      }

      if (failed) {
        if (pendingPollRef.current) {
          window.clearInterval(pendingPollRef.current)
          pendingPollRef.current = null
        }

        setScreen('failed')
        setResult({
          title: 'Payment failed',
          message: status.message || 'Razorpay could not complete this payment.',
          tone: 'danger',
        })
        setStatusNote('Payment failed.')
        postMobileEvent('PAYMENT_FAILED', {
          status: 'failed',
          orderId,
        })
        return
      }

      if (manual) {
        setResult({
          title: 'Payment still pending',
          message: status.message || 'Final confirmation is still in progress. Please check again shortly.',
          tone: 'warning',
        })
      }
    } catch (error) {
      if (manual) {
        setPageError(getErrorMessage(error, 'Unable to check payment status. Please try again.'))
      }
    }
  }

  function getCheckoutClaimToken() {
    if (typeof window === 'undefined') {
      return ''
    }

    return window.sessionStorage.getItem(CHECKOUT_CLAIM_TOKEN_KEY) || ''
  }

  function getStoredCheckoutSession() {
    if (typeof window === 'undefined') {
      return {
        orderId: '',
        claimToken: '',
        phoneE164: '',
        email: '',
        accountExists: false,
        sessionUser: false,
      }
    }

    return {
      orderId: window.sessionStorage.getItem(CHECKOUT_PAYMENT_ORDER_ID_KEY) || '',
      claimToken: window.sessionStorage.getItem(CHECKOUT_CLAIM_TOKEN_KEY) || '',
      phoneE164: window.sessionStorage.getItem(CHECKOUT_PHONE_KEY) || '',
      email: window.sessionStorage.getItem(CHECKOUT_EMAIL_KEY) || '',
      accountExists: window.sessionStorage.getItem(CHECKOUT_ACCOUNT_EXISTS_KEY) === '1',
      sessionUser: window.sessionStorage.getItem(CHECKOUT_SESSION_USER_KEY) === '1',
    }
  }

  function clearStoredCheckoutSession() {
    if (typeof window === 'undefined') {
      return
    }

    window.sessionStorage.removeItem(CHECKOUT_PAYMENT_ORDER_ID_KEY)
    window.sessionStorage.removeItem(CHECKOUT_CLAIM_TOKEN_KEY)
    window.sessionStorage.removeItem(CHECKOUT_PHONE_KEY)
    window.sessionStorage.removeItem(CHECKOUT_EMAIL_KEY)
    window.sessionStorage.removeItem(CHECKOUT_ACCOUNT_EXISTS_KEY)
    window.sessionStorage.removeItem(CHECKOUT_SESSION_USER_KEY)
  }

  async function openAccountSetup(orderId: string) {
    const claimToken = getCheckoutClaimToken()

    if (!orderId || !claimToken) {
      setScreen('error')
      setPageError('Checkout session could not be verified. Please contact support with your payment id.')
      setResult({
        title: 'Checkout session expired',
        message: 'The payment is captured, but this browser no longer has the claim token needed to complete setup.',
        tone: 'danger',
      })
      postMobileEvent('PAYMENT_FAILED', {
        status: 'claim_invalid',
        orderId,
      })
      return
    }

    setPaymentOrderId(orderId)
    setAccountSetupStep('profile')
    setScreen('accountSetup')
    setCheckoutLoading(false)
    setStatusNote('Complete account setup to activate access.')
    setResult({
      title: 'Payment confirmed',
      message: 'Verify your phone and complete your profile to activate course access.',
      tone: 'success',
    })

    if (!accountOtpStarted) {
      await startCheckoutOtp(orderId, claimToken)
    }
  }

  async function startCheckoutOtp(orderId = paymentOrderId, claimToken = getCheckoutClaimToken()) {
    if (!orderId || !claimToken) {
      setAccountError('Checkout session is missing. Please contact support with your payment id.')
      return
    }

    setAccountSetupLoading(true)
    setAccountError('')

    try {
      await apiFetch('/auth/checkout/otp/start', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({
          paymentOrderId: orderId,
          claimToken,
          channel: 'sms',
        }),
      })
      setAccountOtpStarted(true)
      setStatusNote('OTP sent for checkout verification.')
    } catch (error) {
      setAccountError(getAccountSetupErrorMessage(error, 'Could not send OTP. Please try again.'))
    } finally {
      setAccountSetupLoading(false)
    }
  }

  async function handleCompleteAccountSetup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const name = accountName.trim()
    const age = Number(accountAge)
    const code = accountOtp.trim()
    const claimToken = getCheckoutClaimToken()
    const storedCheckoutSession = getStoredCheckoutSession()
    const isExistingAccountCheckout = storedCheckoutSession.accountExists

    if (!paymentOrderId || !claimToken) {
      setAccountError('Checkout session is missing. Please contact support with your payment id.')
      return
    }

    if (!code || code.length < 4) {
      setAccountError('Enter the OTP sent to your mobile number.')
      return
    }

    if (!isExistingAccountCheckout && !name) {
      setAccountError('Enter your name to continue.')
      return
    }

    if (!isExistingAccountCheckout && (!Number.isFinite(age) || age < 10 || age > 99)) {
      setAccountError('Enter a valid age.')
      return
    }

    if (!isExistingAccountCheckout && !accountGender) {
      setAccountError('Choose your gender.')
      return
    }

    if (!isExistingAccountCheckout && !accountTermsAccepted) {
      setAccountError('Accept the terms and privacy policy to continue.')
      return
    }

    setAccountSetupLoading(true)
    setAccountError('')

    try {
      const completed = await apiFetch<CheckoutOtpVerifyResponse>('/auth/checkout/otp/verify', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({
          paymentOrderId,
          claimToken,
          code,
          name: isExistingAccountCheckout ? undefined : name,
          gender: isExistingAccountCheckout ? undefined : accountGender,
          privacyPolicyVersion: privacyPolicyVersion || undefined,
        }),
      })

      tokenStore.setTokens({
        accessToken: completed.accessToken,
        refreshToken: completed.refreshToken,
      })

      if (!completed.accessToken) {
        throw new Error('Account setup completed, but the backend did not return an access token.')
      }

      clearStoredCheckoutSession()

      await Promise.allSettled([
        apiFetch('/me'),
        apiFetch('/me/courses'),
      ])

      if (isExistingAccountCheckout) {
        setAuthMode('bearer')
        setScreen('success')
        setShowSuccessModal(false)
        setResult({
          title: 'Access unlocked',
          message: 'Your account is verified and course access is active.',
          tone: 'success',
        })
        setStatusNote('Account verified successfully.')
        postMobileEvent('PAYMENT_SUCCESS', {
          status: 'success',
          orderId: paymentOrderId,
        })
        return
      }

      setAuthMode('bearer')
      setAccountSetupStep('course')
      setAccountOtp('')
      setAccountOtpStarted(false)
      await loadCourseOptions('Choose your course to finish setup.')
    } catch (error) {
      setAccountError(getAccountSetupErrorMessage(error, 'Could not complete account setup. Please try again.'))
    } finally {
      setAccountSetupLoading(false)
    }
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

  async function handleSelectPublicPlan(plan: BillingPlan) {
    setSelectedPlanId(plan.planId)
    setScreen('booting')
    setStatusNote('Loading selected plan...')
    await router.push({
      pathname: '/payment',
      query: {
        planId: plan.planId,
      },
    }, undefined, { scroll: false })
  }

  function getCheckoutActionState(): CheckoutActionState | null {
    if (
      screen === 'booting' ||
      screen === 'planSelect' ||
      screen === 'otp' ||
      screen === 'course' ||
      screen === 'accountSetup' ||
      screen === 'error' ||
      screen === 'success'
    ) {
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

  function handleCheckoutFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (screen === 'otp') {
      if (otpRequested) {
        void handleVerifyOtp()
        return
      }

      void handleRequestOtp()
      return
    }

    void handlePayNow()
  }

  function getPrimaryActionLabel() {
    if (paymentPhoneOtpRequired) {
      return checkoutLoading ? 'Verifying phone...' : 'Verify and start learning'
    }

    if (screen === 'otp') {
      if (otpRequested) {
        return otpLoading && otpAction === 'verify' ? 'Verifying OTP...' : 'Verify OTP'
      }

      return otpLoading && otpAction === 'send' ? 'Sending OTP...' : 'Send OTP'
    }

    if (screen === 'processing') {
      return 'Verifying payment...'
    }

    if (screen === 'pending') {
      return result?.returnUrl ? 'Return to app' : 'Payment pending'
    }

    return checkoutLoading ? 'Opening Razorpay...' : 'Start Learning'
  }

  function isPrimaryActionDisabled() {
    if (screen === 'otp') {
      return otpLoading || phone.trim().length < 10 || (otpRequested && otp.trim().length < 4)
    }

    if (isPrimaryPaymentLinksFlow && !sessionUser) {
      return (
        checkoutLoading ||
        screen === 'processing' ||
        screen === 'pending' ||
        !selectedPlan ||
        phone.trim().length < 10 ||
        !billingDetails.email.trim()
      )
    }

    return (
      checkoutLoading ||
      screen === 'processing' ||
      screen === 'pending' ||
      !selectedPlan ||
      (!isPrimaryPaymentLinksFlow && !razorpayReady) ||
      (paymentPhoneOtpRequired && otp.trim().length < 4)
    )
  }

  function renderAccountSetup() {
    const storedCheckoutSession = getStoredCheckoutSession()
    const isExistingAccountCheckout = storedCheckoutSession.accountExists

    return (
      <div className="mx-auto flex min-h-[58vh] max-w-xl items-center">
        <form
          onSubmit={handleCompleteAccountSetup}
          className="w-full rounded-3xl border border-purple-100 bg-white p-5 text-slate-950 shadow-[0_18px_48px_rgba(107,33,168,0.10)] sm:p-6"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#6b21a8]">
            {isExistingAccountCheckout ? 'Verify account' : 'Complete account setup'}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
            {isExistingAccountCheckout ? 'Verify your account' : 'Activate your account'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {isExistingAccountCheckout
              ? `Enter the OTP sent to ${formatStoredPhoneLabel(storedCheckoutSession.phoneE164)} to unlock your paid access.`
              : `Enter the OTP sent to ${formatStoredPhoneLabel(storedCheckoutSession.phoneE164)} and complete your profile.`}
          </p>

          <div className="mt-5">
            <InputField
              label="OTP code"
              value={accountOtp}
              onChange={(value) => {
                setAccountOtp(value.replace(/\D/g, '').slice(0, 6))
                setAccountError('')
              }}
              inputMode="numeric"
              disabled={accountSetupLoading}
            />
          </div>

          {!isExistingAccountCheckout && (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <InputField
                    label="Full name"
                    value={accountName}
                    onChange={(value) => {
                      setAccountName(value)
                      setAccountError('')
                    }}
                    disabled={accountSetupLoading}
                  />
                </div>
                <InputField
                  label="Age"
                  value={accountAge}
                  onChange={(value) => {
                    setAccountAge(value.replace(/\D/g, '').slice(0, 2))
                    setAccountError('')
                  }}
                  inputMode="numeric"
                  disabled={accountSetupLoading}
                />
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Gender</span>
                  <select
                    value={accountGender}
                    onChange={(event) => {
                      setAccountGender(event.target.value as AccountGender)
                      setAccountError('')
                    }}
                    disabled={accountSetupLoading}
                    className="h-[47px] w-full rounded-2xl border border-purple-100 bg-white px-3 text-sm text-slate-900 shadow-[0_8px_18px_rgba(107,33,168,0.05)] outline-none transition focus:border-[#6b21a8] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <option value="">Select</option>
                    <option value="FEMALE">Female</option>
                    <option value="MALE">Male</option>
                    <option value="NON_BINARY">Non-binary</option>
                    <option value="OTHER">Other</option>
                    <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                  </select>
                </label>
              </div>

              <label className="mt-5 flex items-start gap-3 text-sm leading-5 text-slate-600">
                <input
                  type="checkbox"
                  checked={accountTermsAccepted}
                  onChange={(event) => {
                    setAccountTermsAccepted(event.target.checked)
                    setAccountError('')
                  }}
                  disabled={accountSetupLoading}
                  className="mt-0.5 h-4 w-4 rounded border-purple-200 text-[#6b21a8] focus:ring-[#6b21a8]"
                />
                <span>
                  I accept the{' '}
                  <a href="/terms-and-conditions" className="font-semibold text-[#6b21a8] hover:underline">
                    Terms
                  </a>{' '}
                  and{' '}
                  <a href="/privacy-policy" className="font-semibold text-[#6b21a8] hover:underline">
                    Privacy Policy
                  </a>
                  .
                </span>
              </label>
            </>
          )}

          <div className="mt-5 space-y-3">
            {accountError && <MessageBanner tone="danger">{accountError}</MessageBanner>}
            {!accountError && accountOtpStarted && (
              <MessageBanner tone="success">OTP sent to the phone number used for checkout.</MessageBanner>
            )}
          </div>

          <button
            type="submit"
            disabled={accountSetupLoading}
            className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-[#6b21a8] px-5 py-3 text-sm font-bold text-white shadow-[0_14px_28px_rgba(107,33,168,0.18)] transition hover:bg-[#581c87] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {accountSetupLoading
              ? isExistingAccountCheckout ? 'Verifying account...' : 'Completing setup...'
              : isExistingAccountCheckout ? 'Verify and unlock access' : 'Complete account setup'}
          </button>

          <button
            type="button"
            onClick={() => void startCheckoutOtp()}
            disabled={accountSetupLoading}
            className="mt-3 w-full rounded-2xl border border-purple-100 bg-white px-4 py-3 text-sm font-semibold text-[#6b21a8] transition hover:border-[#6b21a8] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {accountSetupLoading ? 'Please wait...' : 'Resend OTP'}
          </button>
        </form>
      </div>
    )
  }

  function renderPlanSelection() {
    const displayPlans = activePlans.length ? activePlans : plans

    return (
      <section className="space-y-5">
        <div className="rounded-3xl border border-purple-100 bg-white p-5 shadow-[0_18px_48px_rgba(107,33,168,0.08)] sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
            <SectionHeading
              eyebrow="Plans"
              title="Choose your NEET-PG access"
              description="Select a plan now. You can apply a coupon on the next step before opening Razorpay."
            />

            {sessionUser && <SessionCustomerCard user={sessionUser} />}
          </div>
        </div>

        {pageError && <MessageBanner tone="danger">{pageError}</MessageBanner>}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {displayPlans.map((plan, index) => (
            <PricingPlanCard
              key={plan.planId}
              meta={getPricingPlanMeta(plan, displayPlans)}
              onSelect={handleSelectPublicPlan}
              plan={plan}
              tilt={index % 2 === 0 ? 'left' : 'right'}
            />
          ))}
        </div>
      </section>
    )
  }

  function renderCheckoutForm() {
    const disabled = checkoutLoading || screen === 'processing' || screen === 'pending'
    const showContactFields = !isSessionPaymentLinkCheckout

    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <form
          onSubmit={handleCheckoutFormSubmit}
          className="rounded-3xl border border-purple-100 bg-white p-4 text-slate-950 shadow-[0_18px_48px_rgba(107,33,168,0.10)] sm:p-5"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#6b21a8]">
                Checkout
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                {showContactFields ? 'Contact details' : 'Payment details'}
              </h1>
            </div>
            <p className="rounded-full bg-purple-50 px-3 py-1.5 text-xs font-semibold text-[#6b21a8]">
              Razorpay
            </p>
          </div>

          {showContactFields ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <InputField
                  label="Mobile number"
                  hint="+91"
                  value={phone}
                  onChange={(value) => {
                    setPhone(value.replace(/\D/g, '').slice(0, 10))
                    setAuthError('')
                    setBillingError('')
                  }}
                  inputMode="numeric"
                  disabled={otpLoading || disabled}
                />
              </div>

              {((screen === 'otp' && otpRequested) || paymentPhoneOtpRequired) && (
                <div className="sm:col-span-2">
                  <InputField
                    label="OTP"
                    value={otp}
                    onChange={(value) => {
                      setOtp(value.replace(/\D/g, '').slice(0, 6))
                      setAuthError('')
                    }}
                    inputMode="numeric"
                    disabled={otpLoading || checkoutLoading}
                  />
                </div>
              )}

              <div className="sm:col-span-2">
                <InputField
                  label="Email"
                  value={billingDetails.email}
                  onChange={(value) => updateBillingField('email', value)}
                  inputMode="email"
                  disabled={disabled}
                />
              </div>
            </div>
          ) : (
            <div className="mt-5">
              <SessionCustomerCard user={sessionUser} />
            </div>
          )}

          {checkoutPricing && selectedPlan && (
            <div className="mt-6">
              <CouponSection
                appliedCode={activeCouponCode}
                couponCode={couponCode}
                disabled={disabled || checkoutLoading}
                error={couponError}
                loading={couponLoading}
                message={couponMessage}
                onApply={handleApplyCoupon}
                onChange={(value) => {
                  setCouponCode(normalizeCouponInput(value))
                  setCouponError('')
                  setCouponMessage('')
                  if (!value.trim()) {
                    setCouponQuote(null)
                    setAppliedCouponCode('')
                  }
                }}
                onRemove={handleRemoveCoupon}
                pricing={checkoutPricing}
              />
            </div>
          )}

          <div className="mt-5 space-y-3">
            {authError && <MessageBanner tone="danger">{authError}</MessageBanner>}
            {billingError && <MessageBanner tone="danger">{billingError}</MessageBanner>}
            {pageError && <MessageBanner tone="danger">{pageError}</MessageBanner>}
            {result && screen !== 'success' && (
              <MessageBanner tone={result.tone === 'danger' ? 'danger' : result.tone}>
                <span className="font-semibold">{result.title}</span>
                <span className="mt-1 block">{result.message}</span>
              </MessageBanner>
            )}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <button
              type="submit"
              disabled={isPrimaryActionDisabled()}
              className="inline-flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-[#6b21a8] px-5 py-3 text-sm font-bold text-white shadow-[0_16px_32px_rgba(107,33,168,0.22)] transition hover:bg-[#581c87] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {getPrimaryActionLabel()}
            </button>

            {screen === 'otp' && otpRequested && (
              <button
                type="button"
                onClick={handleRequestOtp}
                disabled={otpLoading}
                className="inline-flex min-h-[48px] items-center justify-center rounded-2xl border border-purple-200 bg-white px-5 py-3 text-sm font-bold text-[#6b21a8] transition hover:border-[#6b21a8] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {otpLoading && otpAction === 'send' ? 'Resending...' : 'Resend OTP'}
              </button>
            )}

            {screen === 'pending' && paymentOrderId && (
              <button
                type="button"
                onClick={() => void checkPaymentLinkStatus(paymentOrderId, true)}
                className="inline-flex min-h-[48px] items-center justify-center rounded-2xl border border-purple-200 bg-white px-5 py-3 text-sm font-bold text-[#6b21a8] transition hover:border-[#6b21a8]"
              >
                {statusTimedOut ? 'Check status again' : 'Check status'}
              </button>
            )}
          </div>
        </form>

        {renderPlanSummary()}
      </div>
    )
  }

  function renderPlanSummary() {
    const planTitle = selectedPlan ? formatPlanTitle(selectedPlan) : 'Selected plan'
    const durationLabel = selectedPlan ? formatPlanDuration(selectedPlan.durationMonths) : ''
    const totalLabel = checkoutPricing
      ? formatCurrency(checkoutPricing.finalAmountPaise, checkoutPricing.currency)
      : '-'
    const baseLabel = checkoutPricing
      ? formatCurrency(checkoutPricing.baseAmountPaise, checkoutPricing.currency)
      : '-'

    return (
      <aside className="rounded-3xl border border-[#6b21a8]/15 bg-[#6b21a8] p-5 text-white shadow-[0_18px_48px_rgba(107,33,168,0.18)]">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#d3b8ff]">
          Plan summary
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em]">{planTitle}</h2>
        {durationLabel && <p className="mt-1 text-sm font-medium text-white/70">{durationLabel}</p>}

        <div className="mt-5 space-y-3 border-y border-white/14 py-5">
          <PlanFeature>Access to 7000+ PYQs</PlanFeature>
          <PlanFeature>Complete handwritten notes</PlanFeature>
          <PlanFeature>Custom test creation</PlanFeature>
          <PlanFeature>Mobile app access after payment</PlanFeature>
        </div>

        <div className="mt-5 space-y-2.5">
          <SummaryPriceLine label="Subtotal" value={baseLabel} />
          {checkoutPricing && checkoutPricing.discountAmountPaise > 0 && (
            <SummaryPriceLine
              label="Discount"
              value={`-${formatCurrency(checkoutPricing.discountAmountPaise, checkoutPricing.currency)}`}
              tone="success"
            />
          )}
          <div className="flex items-center justify-between gap-4 pt-2">
            <span className="text-sm font-bold text-white">Due today</span>
            <span className="text-3xl font-bold tracking-[-0.04em] text-white">{totalLabel}</span>
          </div>
        </div>
      </aside>
    )
  }

  function renderSuccessPage() {
    const courseTitle = selectedCoursePreview?.title || selectedCourse?.title || activeGroup?.course.title || 'Virtual Library'

    return (
      <section className="mx-auto grid max-w-5xl items-center gap-5 py-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:py-10">
        <div className="rounded-3xl border border-purple-100 bg-white p-6 shadow-[0_18px_48px_rgba(107,33,168,0.10)] sm:p-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f4eeff] text-[#6b21a8]">
            <CheckIcon className="h-8 w-8" />
          </div>
          <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.22em] text-[#6b21a8]">
            Access ready
          </p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-[-0.04em] text-slate-950 sm:text-5xl">
            Your access is ready.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-500">
            Download the Virtual Library mobile app and sign in with the phone number used for checkout to start learning.
          </p>

          <div className="mt-7">
            <DownloadOptions variant="light" />
          </div>
        </div>

        <aside className="rounded-3xl bg-[#6b21a8] p-6 text-white shadow-[0_24px_56px_rgba(107,33,168,0.22)]">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#d3b8ff]">
            Subscription
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em]">{courseTitle}</h2>
          <div className="mt-6 space-y-3 border-y border-white/14 py-5">
            <PlanFeature>Course access is active</PlanFeature>
            <PlanFeature>Mobile app access is enabled</PlanFeature>
            <PlanFeature>Study rooms, PYQs, notes, and custom tests are ready</PlanFeature>
          </div>
          <a
            href="/v2/neet-pg/access"
            className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-bold text-[#6b21a8] transition hover:bg-[#f6f1ff]"
          >
            View access details
          </a>
        </aside>
      </section>
    )
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
      return renderCheckoutForm()
    }

    if (screen === 'planSelect') {
      return renderPlanSelection()
    }

    if (screen === 'accountSetup') {
      return renderAccountSetup()
    }

    if (screen === 'course') {
      return (
        <div className={cn('space-y-6', accountSetupStep === 'course' && 'mx-auto max-w-xl rounded-3xl border border-purple-100 bg-white p-5 shadow-[0_18px_48px_rgba(107,33,168,0.10)] sm:p-6')}>
          <SectionHeading
            eyebrow="Course"
            title={accountSetupStep === 'course' ? 'Which course are you in?' : 'Choose your exam'}
            description={
              accountSetupStep === 'course'
                ? 'Select the exam you are preparing for.'
                : 'We will load the most relevant plan options after you confirm your course.'
            }
          />

          {accountSetupStep === 'course' ? (
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Course</span>
              <select
                value={selectedCourseChoice}
                onChange={(event) => {
                  setSelectedCourseChoice(event.target.value)
                  setCourseError('')
                }}
                disabled={courseLoading}
                className="h-[52px] w-full rounded-2xl border border-purple-100 bg-white px-4 text-sm font-semibold text-slate-900 shadow-[0_8px_18px_rgba(107,33,168,0.05)] outline-none transition focus:border-[#6b21a8] disabled:cursor-not-allowed disabled:opacity-70"
              >
                <option value="">Select your course</option>
                {courseOptions.map((course) => (
                  <option key={course.courseId} value={course.courseId}>
                    {course.title}
                  </option>
                ))}
                {customCourseOption && (
                  <option value={customCourseOption.key}>{customCourseOption.title}</option>
                )}
              </select>
            </label>
          ) : (
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
                        ? 'border-[#6b21a8] bg-[#faf7ff]'
                        : 'border-purple-100 bg-white hover:border-[#d3b8ff]'
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
                      ? 'border-[#6b21a8] bg-[#faf7ff]'
                      : 'border-purple-100 bg-white hover:border-[#d3b8ff]'
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
          )}

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
              className="rounded-2xl bg-[#6b21a8] px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(107,33,168,0.18)] transition hover:bg-[#581c87] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {courseLoading
                ? 'Saving your course...'
                : accountSetupStep === 'course'
                  ? 'Finish setup'
                  : 'Continue to plans'}
            </button>

            {accountSetupStep !== 'course' && (
              <button
                type="button"
                onClick={() => {
                  tokenStore.clear()
                  openOtpScreen('Sign in with a different phone number.')
                }}
                className="rounded-2xl border border-purple-100 bg-white px-4 py-3 text-sm font-semibold text-[#6b21a8] transition hover:border-[#6b21a8]"
              >
                Use another phone number
              </button>
            )}
          </div>
        </div>
      )
    }

    if (screen === 'success') {
      return renderSuccessPage()
    }

    return renderCheckoutForm()
  }

  function renderFooterAction() {
    return null
  }

  return (
    <>
      <Head>
        <title>Payment - Virtual Library</title>
        <meta name="description" content="Secure checkout for Virtual Library memberships." />
        <meta name="robots" content="noindex, nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {shouldLoadCheckoutScript && (
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="afterInteractive"
          onLoad={() => setRazorpayReady(true)}
          onError={() => setPageError('Could not load Razorpay Checkout. Please refresh and try again.')}
        />
      )}

      <div className="min-h-screen bg-[#f8f7fb] px-4 py-4 text-slate-900 sm:px-6">
        <div className="mx-auto flex min-h-full max-w-5xl flex-col">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-purple-100 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-[#6b21a8]/40"
            >
              <ChevronLeftIcon className="h-3.5 w-3.5" />
              Back
            </button>

            <div className="min-w-0 rounded-full border border-purple-100 bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b21a8] shadow-sm">
              <span className="block truncate">
                {selectedCoursePreview?.title || activeGroup?.course.title || 'Virtual Library'}
              </span>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#6b21a8]">
              Secure checkout
              </p>
              <h1 className="mt-1 text-3xl font-semibold leading-none tracking-[-0.04em] text-slate-950 sm:text-4xl">
                Payment
              </h1>
            </div>
          </div>

          <main className="mt-4 min-h-0 flex-1">
            {renderBodyContent()}
          </main>

          {renderFooterAction()}

          <div className="mt-3 flex flex-wrap justify-center gap-4 pb-1 text-[11px] font-medium text-slate-400">
            <a href="/terms-and-conditions" className="transition hover:text-[#6b21a8]">
              Terms
            </a>
            <a href="/privacy-policy" className="transition hover:text-[#6b21a8]">
              Privacy
            </a>
            <a href="/refund-policy" className="transition hover:text-[#6b21a8]">
              Refunds
            </a>
          </div>
        </div>
      </div>

      <SuccessCompletionModal
        isOpen={showSuccessModal && screen === 'success' && Boolean(result?.returnUrl)}
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
    <section className="rounded-2xl border border-purple-100 bg-white px-3 py-3 shadow-[0_10px_24px_rgba(107,33,168,0.05)]">
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
            className="h-11 w-full rounded-2xl border border-purple-100 bg-[#fbfaff] px-3 text-sm font-semibold uppercase tracking-[0.08em] text-slate-900 outline-none transition focus:border-[#6b21a8] focus:bg-white disabled:cursor-not-allowed disabled:opacity-70"
            autoComplete="off"
          />
        </label>

        <button
          type="submit"
          disabled={!canApply || loading}
          className="h-11 shrink-0 rounded-2xl bg-[#6b21a8] px-4 text-sm font-semibold text-white shadow-[0_12px_22px_rgba(107,33,168,0.16)] transition hover:bg-[#581c87] disabled:cursor-not-allowed disabled:opacity-55"
        >
          {loading ? 'Applying...' : 'Apply'}
        </button>
      </form>

      {hasAppliedCoupon && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
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

      <div className="mt-4 space-y-1.5 border-t border-purple-50 pt-3">
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

function SummaryPriceLine({
  label,
  tone,
  value,
}: {
  label: string
  tone?: 'success'
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-white/52">{label}</span>
      <span className={cn('font-semibold text-white/84', tone === 'success' && 'text-[#7dd3a8]')}>
        {value}
      </span>
    </div>
  )
}

function PlanFeature({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#d3b8ff] text-[#d3b8ff]">
        <CheckIcon className="h-3 w-3" />
      </span>
      <p className="text-sm leading-5 text-white/82">{children}</p>
    </div>
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
      ? 'border-[#e9ddff] bg-white text-[#5b21b6] shadow-[0_16px_34px_rgba(28,10,74,0.10)] hover:bg-[#f6f1ff]'
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

function SessionCustomerCard({ user }: { user: PaymentSessionUser | null }) {
  const phoneLabel = user?.phoneE164 ? maskPhone(user.phoneE164) : 'Signed in'
  const emailLabel = user?.email ? maskEmail(user.email) : ''

  return (
    <div className="rounded-2xl border border-purple-100 bg-[#fbf9ff] px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b21a8]">
        Signed in
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{phoneLabel}</p>
      {emailLabel && <p className="mt-0.5 text-xs font-medium text-slate-500">{emailLabel}</p>}
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
          ? 'border-[#6b21a8] bg-[#f4eeff] shadow-[0_18px_36px_rgba(107,33,168,0.12)]'
          : 'border-purple-100 bg-white hover:border-[#d3b8ff]',
        disabled && 'cursor-not-allowed opacity-75'
      )}
    >
      {tag && (
        <span className="absolute right-5 top-0 -translate-y-1/2 rounded-lg bg-[#6b21a8] px-4 py-2 text-xs font-bold text-white shadow-[0_10px_24px_rgba(107,33,168,0.18)]">
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
        'flex items-center justify-center gap-2 rounded-2xl bg-[#6b21a8] px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(107,33,168,0.22)] transition hover:bg-[#581c87] disabled:cursor-not-allowed disabled:opacity-60',
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
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-purple-100 border-t-[#6b21a8]" />
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
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6b21a8]">{eyebrow}</p>
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
      <div className="flex items-center rounded-2xl border border-purple-100 bg-white px-3 shadow-[0_8px_18px_rgba(107,33,168,0.05)] focus-within:border-[#6b21a8]">
        {hint && <span className="mr-3 text-sm font-semibold text-slate-400">{hint}</span>}
        <input
          type="text"
          inputMode={inputMode}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder || undefined}
          disabled={disabled}
          className="w-full border-0 bg-transparent px-0 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-0"
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
        'rounded-2xl border px-4 py-3 text-sm',
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
        active ? 'border-[#6b21a8] bg-[#6b21a8]' : 'border-purple-200 bg-white'
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
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f4eeff] text-[#6b21a8]">
          <CheckIcon className="h-7 w-7" />
        </div>

        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6b21a8]">
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
          className="mt-6 w-full rounded-2xl bg-[#6b21a8] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_18px_34px_rgba(107,33,168,0.22)] transition hover:bg-[#581c87]"
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

function getDefaultPlanId(plans: BillingPlan[], requestedPlanId?: string, requestedDurationMonths?: number | null) {
  if (!plans.length) {
    return ''
  }

  if (requestedPlanId && plans.some((plan) => plan.planId === requestedPlanId)) {
    return requestedPlanId
  }

  if (requestedDurationMonths) {
    const durationMatch = plans.find((plan) => plan.durationMonths === requestedDurationMonths)

    if (durationMatch) {
      return durationMatch.planId
    }
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

function getQueryNumber(value: string | string[] | undefined) {
  const parsed = Number(getQueryParam(value))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function getCouponCodeForSubmit(value: string) {
  const normalized = normalizeCouponInput(value)
  return normalized || undefined
}

function getPaymentLinkUrl(created: PaymentLinkCreateResponse) {
  const candidates = [
    created.paymentUrl,
    created.paymentLink?.shortUrl,
    created.paymentLink?.short_url,
  ]
  const match = candidates.find((value) => typeof value === 'string' && /^https?:\/\//i.test(value))

  return typeof match === 'string' ? match : ''
}

function getPaymentErrorCode(error: unknown) {
  if (error instanceof PaymentApiError) {
    return typeof error.body?.code === 'string' ? error.body.code : ''
  }

  return ''
}

function extractSessionUser(body: any): PaymentSessionUser | null {
  const candidates = [
    body?.user,
    body?.data?.user,
    body?.data?.profile,
    body?.data,
    body,
  ].filter((candidate) => candidate && typeof candidate === 'object')

  for (const candidate of candidates) {
    const phoneE164 =
      candidate.phoneE164 ||
      candidate.mobileE164 ||
      candidate.phone ||
      candidate.mobile ||
      candidate.phoneNumber ||
      candidate.profile?.phoneE164 ||
      ''
    const email = candidate.email || candidate.profile?.email || ''
    const name = candidate.name || candidate.fullName || candidate.profile?.name || ''

    if (phoneE164 || email || name) {
      return {
        email: typeof email === 'string' ? email : undefined,
        name: typeof name === 'string' ? name : undefined,
        phoneE164: typeof phoneE164 === 'string' ? phoneE164 : undefined,
      }
    }
  }

  return null
}

function maskEmail(email: string) {
  const [name, domain] = email.split('@')

  if (!name || !domain) {
    return email
  }

  const visible = name.slice(0, Math.min(2, name.length))
  return `${visible}${name.length > 2 ? '***' : ''}@${domain}`
}

function maskPhone(phoneE164: string) {
  return phoneE164.replace(/^(\+91)(\d{2})\d{4}(\d{4})$/, '$1 $2****$3')
}

function getAccountSetupErrorMessage(error: unknown, fallback: string) {
  const code = getPaymentErrorCode(error)

  if (code === 'PAYMENT_NOT_CAPTURED') {
    return 'Payment is still processing. Check status again in a moment.'
  }

  if (code === 'ACCOUNT_ALREADY_READY') {
    return 'This account is already ready. Please log in normally.'
  }

  if (code === 'GUEST_CHECKOUT_CLAIM_INVALID') {
    return 'Checkout session could not be verified. Please contact support with your payment id.'
  }

  if (code === 'EMAIL_ALREADY_IN_USE') {
    return 'This email already has an account. Use that account or choose another email.'
  }

  if (code === 'PHONE_EMAIL_MISMATCH') {
    return 'This phone number is linked to another email. Use the existing email for this phone.'
  }

  return getErrorMessage(error, fallback)
}

function validateBillingDetails(details: BillingDetails, phone: string) {
  if (!/^[0-9]{10}$/.test(phone.trim())) {
    return 'Enter a valid 10-digit mobile number.'
  }

  if (!details.email.trim()) {
    return 'Enter your email address.'
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email.trim())) {
    return 'Enter a valid email address.'
  }

  return ''
}

function formatStoredPhoneLabel(phoneE164: string) {
  if (!phoneE164) {
    return 'your checkout phone number'
  }

  return phoneE164.replace(/^(\+91)(\d{2})\d{4}(\d{4})$/, '$1 $2****$3')
}

function getDirectPaymentLink(order: BillingOrderResponse) {
  const rawOrder = order as BillingOrderResponse & {
    paymentLink?: string
    paymentUrl?: string
    checkoutUrl?: string
    shortUrl?: string
    short_url?: string
    link?: {
      short_url?: string
      url?: string
    }
    payment?: {
      short_url?: string
      url?: string
    }
    razorpay?: BillingOrderResponse['razorpay'] & {
      short_url?: string
    }
  }
  const candidates = [
    rawOrder.paymentLink,
    rawOrder.paymentUrl,
    rawOrder.checkoutUrl,
    rawOrder.shortUrl,
    rawOrder.short_url,
    rawOrder.link?.short_url,
    rawOrder.link?.url,
    rawOrder.payment?.short_url,
    rawOrder.payment?.url,
    rawOrder.razorpay?.paymentLink,
    rawOrder.razorpay?.paymentUrl,
    rawOrder.razorpay?.checkoutUrl,
    rawOrder.razorpay?.shortUrl,
    rawOrder.razorpay?.short_url,
  ]
  const match = candidates.find((value) => typeof value === 'string' && /^https?:\/\//i.test(value))

  return typeof match === 'string' ? match : ''
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
