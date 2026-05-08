export type CourseSummary = {
  courseId: string
  slug: string
  title: string
  description: string | null
  displayOrder?: number
  kind?: string
}

export type BillingPlan = {
  planId: string
  code: string
  name: string
  description: string | null
  durationMonths: number
  amountPaise: number
  currency: string
  course: CourseSummary
}

export type BillingPlansResponse = {
  plans: BillingPlan[]
  selectedCourse: CourseSummary | null
  requiresCourseSelection: boolean
  code?: string
  message?: string
}

export type BillingPricing = {
  baseAmountPaise: number
  discountAmountPaise: number
  finalAmountPaise: number
  currency: string
}

export type BillingCoupon = {
  couponId: string | null
  code: string
  name?: string | null
  description?: string | null
  discountType?: string
  discountValue?: number
  maxDiscountPaise?: number | null
}

export type BillingQuoteResponse = {
  couponStatus: 'NONE' | 'APPLIED' | 'INVALID' | string
  isValidCoupon: boolean
  pricing: BillingPricing
  coupon: BillingCoupon | null
  code?: string
  message?: string
  plan?: BillingPlan
  course?: CourseSummary
  selectedCourse?: CourseSummary | null
}

export type CourseOptionsResponse = {
  courses: CourseSummary[]
  customCourseOption?: {
    key: string
    title: string
    requiresCustomTitle: boolean
  } | null
}

export type BillingOrderResponse = {
  status: string
  orderId: string
  amount: number
  currency: string
  keyId: string
  order: {
    id: string
    status: string
    receipt: string
    amountPaise: number
    currency: string
    providerOrderId: string
    createdAt: string
  }
  razorpay: {
    keyId: string
    orderId: string
    amountPaise: number
    currency: string
  }
  plan: {
    planId: string
    code: string
    name: string
    durationMonths: number
    amountPaise: number
    currency: string
  }
  course: {
    courseId: string
    slug: string
    title: string
    description: string | null
  }
  pricing?: BillingPricing
  coupon?: BillingCoupon | null
  user?: {
    name?: string
    email?: string
    phoneE164?: string
  }
}

export type BillingVerifyResponse = {
  ok: boolean
  status: 'COMPLETED' | 'PENDING' | 'FAILED' | string
  paymentStatus?: string
  subscriptionStatus?: string
  returnUrl?: string
  accessGranted?: boolean
  message?: string
}

export class PaymentApiError extends Error {
  status: number
  body: any

  constructor(message: string, status: number, body?: any) {
    super(message)
    this.name = 'PaymentApiError'
    this.status = status
    this.body = body
  }
}

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || '/api/backend'
const ACCESS_TOKEN_KEY = 'vl_access_token'
const REFRESH_TOKEN_KEY = 'vl_refresh_token'
const OTP_REQUEST_PATH = process.env.NEXT_PUBLIC_AUTH_REQUEST_OTP_PATH || '/auth/login/otp/start'
const OTP_VERIFY_PATH = process.env.NEXT_PUBLIC_AUTH_VERIFY_OTP_PATH || '/auth/login/otp/verify'
const REFRESH_PATH = process.env.NEXT_PUBLIC_AUTH_REFRESH_PATH || '/auth/refresh'

export const tokenStore = {
  getAccessToken() {
    if (typeof window === 'undefined') {
      return null
    }

    return window.sessionStorage.getItem(ACCESS_TOKEN_KEY)
  },

  setAccessToken(token: string) {
    if (typeof window === 'undefined') {
      return
    }

    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, token)
  },

  getRefreshToken() {
    if (typeof window === 'undefined') {
      return null
    }

    return window.sessionStorage.getItem(REFRESH_TOKEN_KEY)
  },

  setRefreshToken(token: string) {
    if (typeof window === 'undefined') {
      return
    }

    window.sessionStorage.setItem(REFRESH_TOKEN_KEY, token)
  },

  setTokens(tokens: { accessToken?: string | null; refreshToken?: string | null }) {
    if (tokens.accessToken) {
      this.setAccessToken(tokens.accessToken)
    }

    if (tokens.refreshToken) {
      this.setRefreshToken(tokens.refreshToken)
    }
  },

  clear() {
    if (typeof window === 'undefined') {
      return
    }

    window.sessionStorage.removeItem(ACCESS_TOKEN_KEY)
    window.sessionStorage.removeItem(REFRESH_TOKEN_KEY)
  },
}

export async function apiFetch<T>(path: string, init: RequestInit = {}) {
  return apiFetchInternal<T>(path, init, true)
}

async function apiFetchInternal<T>(path: string, init: RequestInit = {}, allowRefresh = true) {
  const accessToken = tokenStore.getAccessToken()
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  }

  if (!headers['Content-Type'] && init.body) {
    headers['Content-Type'] = 'application/json'
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })

  const rawBody = await response.text()
  const body = tryParseJson(rawBody)

  if (response.status === 401 && allowRefresh && tokenStore.getRefreshToken()) {
    const refreshed = await refreshAccessToken()

    if (refreshed) {
      return apiFetchInternal<T>(path, init, false)
    }
  }

  if (!response.ok) {
    throw new PaymentApiError(extractErrorMessage(body, rawBody, response.status), response.status, body)
  }

  return body as T
}

export async function requestOtp(phoneInput: string) {
  const phone = normalizeIndianPhone(phoneInput)

  return apiFetch(OTP_REQUEST_PATH, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
    body: JSON.stringify({
      identifier: phone.e164,
    }),
  })
}

export async function verifyOtp(phoneInput: string, otp: string) {
  const phone = normalizeIndianPhone(phoneInput)

  return apiFetch(OTP_VERIFY_PATH, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
    body: JSON.stringify({
      identifier: phone.e164,
      code: otp.trim(),
    }),
  })
}

export function extractAccessToken(body: any) {
  return (
    body?.accessToken ||
    body?.token ||
    body?.data?.accessToken ||
    body?.data?.token ||
    body?.tokens?.accessToken ||
    body?.data?.tokens?.accessToken ||
    null
  )
}

export function extractRefreshToken(body: any) {
  return (
    body?.refreshToken ||
    body?.data?.refreshToken ||
    body?.tokens?.refreshToken ||
    body?.data?.tokens?.refreshToken ||
    null
  )
}

export function normalizeIndianPhone(input: string) {
  const cleaned = input.replace(/\D/g, '')
  const normalizedDigits = cleaned.startsWith('91') && cleaned.length === 12 ? cleaned.slice(2) : cleaned

  if (!/^[0-9]{10}$/.test(normalizedDigits)) {
    throw new Error('Enter a valid 10-digit phone number')
  }

  return {
    digits: normalizedDigits,
    e164: `+91${normalizedDigits}`,
  }
}

export function formatCurrency(amountPaise: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amountPaise / 100)
}

export function buildReturnUrl(baseUrl: string, status: 'success' | 'pending' | 'failed') {
  try {
    const url = new URL(baseUrl)
    url.searchParams.set('status', status)
    return url.toString()
  } catch {
    const separator = baseUrl.includes('?') ? '&' : '?'
    return `${baseUrl}${separator}status=${status}`
  }
}

export function postMobileEvent(type: string, payload?: Record<string, any>) {
  if (typeof window === 'undefined' || !window.ReactNativeWebView?.postMessage) {
    return
  }

  window.ReactNativeWebView.postMessage(JSON.stringify({ type, payload }))
}

export function hasGrantedCourseAccess(payload: any, course?: { courseId?: string; slug?: string } | null) {
  const buckets = [
    payload,
    payload?.courses,
    payload?.data?.courses,
    payload?.data,
  ].filter(Boolean)

  const flattened = buckets.flatMap((bucket) => {
    if (Array.isArray(bucket)) {
      return bucket
    }

    if (Array.isArray(bucket?.courses)) {
      return bucket.courses
    }

    return []
  })

  return flattened.some((item) => {
    const candidateIds = [
      item?.courseId,
      item?.id,
      item?.course?.courseId,
      item?.course?.id,
    ].filter(Boolean)
    const candidateSlugs = [
      item?.slug,
      item?.courseSlug,
      item?.course?.slug,
    ].filter(Boolean)

    return (
      (!!course?.courseId && candidateIds.includes(course.courseId)) ||
      (!!course?.slug && candidateSlugs.includes(course.slug))
    )
  })
}

async function refreshAccessToken() {
  const refreshToken = tokenStore.getRefreshToken()

  if (!refreshToken) {
    return false
  }

  try {
    const response = await fetch(`${API_BASE}${REFRESH_PATH}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${refreshToken}`,
        Accept: 'application/json',
      },
      credentials: 'include',
    })

    const rawBody = await response.text()
    const body = tryParseJson(rawBody)

    if (!response.ok) {
      tokenStore.clear()
      return false
    }

    const nextAccessToken = extractAccessToken(body)
    const nextRefreshToken = extractRefreshToken(body)

    if (!nextAccessToken) {
      tokenStore.clear()
      return false
    }

    tokenStore.setTokens({
      accessToken: nextAccessToken,
      refreshToken: nextRefreshToken || refreshToken,
    })

    return true
  } catch {
    tokenStore.clear()
    return false
  }
}

function tryParseJson(rawBody: string) {
  if (!rawBody) {
    return null
  }

  try {
    return JSON.parse(rawBody)
  } catch {
    return rawBody
  }
}

function extractErrorMessage(body: any, rawBody: string, status: number) {
  if (typeof body === 'string' && body.trim()) {
    return body
  }

  return body?.message || body?.error || rawBody || `HTTP ${status}`
}
