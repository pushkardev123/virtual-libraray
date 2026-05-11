import { useState, useEffect } from 'react'
import Script from 'next/script'
import { useRouter } from 'next/router'
import { PRICING } from '@/config/constants'

interface PaymentFormProps {
  examType?: 'neet-pg' | 'other-exams'
}

export default function PaymentForm({ examType }: PaymentFormProps = {}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [razorpayLoaded, setRazorpayLoaded] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
  })
  
  // Form errors
  const [errors, setErrors] = useState({
    name: '',
    email: '',
    phone: '',
  })

  // Coupon state
  const [discountExpanded, setDiscountExpanded] = useState(false)
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string
    discountPercentage: number
    discountAmount: number
    discountedAmount: number
  } | null>(null)
  const [couponError, setCouponError] = useState('')
  const [applyingCoupon, setApplyingCoupon] = useState(false)

  // Available coupons (publicly displayable)
  type AvailableCoupon = {
    code: string
    discountPercentage: number
    discountAmount: number
    discountedAmount: number
    expiryDate: string
  }
  const [availableCoupons, setAvailableCoupons] = useState<AvailableCoupon[]>([])
  const [loadingAvailableCoupons, setLoadingAvailableCoupons] = useState(true)

  // Check if Razorpay script is already loaded (for cached scenarios)
  useEffect(() => {
    const checkRazorpayLoaded = () => {
      if (typeof window !== 'undefined' && window.Razorpay) {
        setRazorpayLoaded(true)
        return true
      }
      return false
    }

    // Check immediately when component mounts
    if (checkRazorpayLoaded()) {
      return
    }

    // If not loaded, check periodically for up to 10 seconds
    let attempts = 0
    const maxAttempts = 20 // 10 seconds (20 * 500ms)
    
    const intervalId = setInterval(() => {
      attempts++
      if (checkRazorpayLoaded() || attempts >= maxAttempts) {
        clearInterval(intervalId)
        if (attempts >= maxAttempts && !razorpayLoaded) {
          console.error('Razorpay script failed to load within timeout')
        }
      }
    }, 500)

    return () => clearInterval(intervalId)
  }, [])

  // Fetch publicly displayable coupons
  useEffect(() => {
    let cancelled = false

    const fetchAvailableCoupons = async () => {
      try {
        const response = await fetch('/api/payment/available-coupons')
        const data = await response.json()
        if (!cancelled && response.ok && data?.data?.coupons) {
          setAvailableCoupons(data.data.coupons)
        }
      } catch (error) {
        console.error('Failed to fetch available coupons:', error)
      } finally {
        if (!cancelled) setLoadingAvailableCoupons(false)
      }
    }

    fetchAvailableCoupons()
    return () => {
      cancelled = true
    }
  }, [])

  // Handle input changes
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  // Validate form
  const validateForm = () => {
    const newErrors = {
      name: '',
      email: '',
      phone: '',
    }
    
    let isValid = true

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
      isValid = false
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
      isValid = false
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Invalid email address'
      isValid = false
    }

    const phoneRegex = /^[0-9]{10}$/
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required'
      isValid = false
    } else if (!phoneRegex.test(formData.phone)) {
      newErrors.phone = 'Phone number must be 10 digits'
      isValid = false
    }

    setErrors(newErrors)
    return isValid
  }

  // Apply coupon code (optionally pass an explicit code, e.g. from the
  // available-coupons list, otherwise the manually-entered code is used)
  const handleApplyCoupon = async (codeOverride?: string) => {
    const codeToApply = (codeOverride ?? couponCode).trim()

    if (!codeToApply) {
      setCouponError('Please enter a coupon code')
      return
    }

    setApplyingCoupon(true)
    setCouponError('')

    try {
      const response = await fetch('/api/payment/validate-coupon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: codeToApply }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Invalid coupon code')
      }

      setAppliedCoupon({
        code: data.data.code,
        discountPercentage: data.data.discountPercentage,
        discountAmount: data.data.discountAmount,
        discountedAmount: data.data.discountedAmount,
      })
      setCouponCode(data.data.code)
      setCouponError('')
    } catch (error: any) {
      setCouponError(error.message || 'Failed to apply coupon')
      setAppliedCoupon(null)
    } finally {
      setApplyingCoupon(false)
    }
  }

  // Remove applied coupon
  const handleRemoveCoupon = () => {
    setAppliedCoupon(null)
    setCouponCode('')
    setCouponError('')
    setDiscountExpanded(false)
  }

  // Handle payment
  const handlePayment = async () => {
    // Validate form
    if (!validateForm()) {
      return
    }

    if (!razorpayLoaded) {
      alert('Payment gateway is loading. Please try again in a moment.')
      return
    }

    setLoading(true)

    try {
      // Track InitiateCheckout event for Meta Pixel
      if (typeof window !== 'undefined' && window.fbq) {
        window.fbq('track', 'InitiateCheckout', {
          content_name: 'Virtual Library Membership',
          content_category: examType || 'general',
          value: appliedCoupon ? appliedCoupon.discountedAmount : PRICING.MEMBERSHIP_FEE,
          currency: PRICING.CURRENCY,
        });
      }

      // Create order on backend
      const response = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          amount: PRICING.MEMBERSHIP_FEE, // Always send original amount, backend will apply discount
          examType: examType || 'general',
          couponCode: appliedCoupon?.code,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create order')
      }

      // Initialize Razorpay
      const options: RazorpayOptions = {
        key: data.data.keyId,
        amount: data.data.amount,
        currency: PRICING.CURRENCY,
        name: 'Virtual Library',
        description: 'One-time membership fee',
        order_id: data.data.orderId,
        prefill: {
          name: formData.name,
          email: formData.email,
          contact: formData.phone,
        },
        theme: {
          color: '#000000',
        },
        handler: async function (response: RazorpaySuccessResponse) {
          // Verify payment on backend
          await verifyPayment(response)
        },
        modal: {
          ondismiss: function () {
            setLoading(false)
            console.log('Payment cancelled by user')
          },
        },
      }

      const razorpay = new window.Razorpay(options)
      
      // Handle payment failures
      razorpay.on('payment.failed', function (response: any) {
        console.error('Payment failed:', response.error)
        
        // Redirect to failure page with payment details
        const errorMsg = response.error.description || 'Payment failed. Please try again.'
        const amount = appliedCoupon ? appliedCoupon.discountedAmount : PRICING.MEMBERSHIP_FEE
        router.push({
          pathname: '/payment-failed',
          query: { 
            error: errorMsg,
            amount: amount.toString(),
            examType: examType || 'general'
          }
        })
        setLoading(false)
      })

      razorpay.open()
    } catch (error: any) {
      console.error('Error initiating payment:', error)
      
      // Redirect to failure page with payment details
      const errorMsg = error.message || 'Failed to initiate payment. Please try again.'
      const amount = appliedCoupon ? appliedCoupon.discountedAmount : PRICING.MEMBERSHIP_FEE
      router.push({
        pathname: '/payment-failed',
        query: { 
          error: errorMsg,
          amount: amount.toString(),
          examType: examType || 'general'
        }
      })
      setLoading(false)
    }
  }

  // Verify payment
  const verifyPayment = async (response: RazorpaySuccessResponse) => {
    try {
      const verifyResponse = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        }),
      })

      const verifyData = await verifyResponse.json()

      if (verifyResponse.ok) {
        // Payment successful - redirect to success page with secure token
        const token = verifyData.data.paymentId; // Use payment ID as token
        router.push({
          pathname: '/payment-success',
          query: { token }
        })
        
        // Clear form
        setFormData({ name: '', email: '', phone: '' })
      } else {
        throw new Error(verifyData.message || 'Payment verification failed')
      }
    } catch (error: any) {
      console.error('Error verifying payment:', error)
      
      // Redirect to failure page with payment details
      const errorMsg = error.message || 'Payment verification failed. Please contact support with your payment details.'
      const amount = appliedCoupon ? appliedCoupon.discountedAmount : PRICING.MEMBERSHIP_FEE
      router.push({
        pathname: '/payment-failed',
        query: { 
          error: errorMsg,
          amount: amount.toString(),
          examType: examType || 'general'
        }
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Load Razorpay script */}
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
        onLoad={() => {
          console.log('Razorpay script loaded successfully')
          setRazorpayLoaded(true)
        }}
        onError={(e) => {
          console.error('Failed to load Razorpay script:', e)
        }}
        onReady={() => {
          // Additional check when script is ready
          if (typeof window !== 'undefined' && window.Razorpay) {
            setRazorpayLoaded(true)
          }
        }}
      />
      
      <section id="paymentForm" className="px-4 py-0">
        <div className="max-w-xl mx-auto bg-white rounded-3xl shadow-lg p-6 md:p-8 mt-12">
          <p className="text-gray-600 mb-4 text-sm">
            Access to this purchase will be sent to this email
          </p>

          <div className="mb-3">
            <input
              type="email"
              placeholder="Email Address"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className={`w-full border ${errors.email ? 'border-red-500' : 'border-gray-200'} rounded-xl px-4 py-2.5 text-gray-700 focus:outline-none focus:border-black`}
              disabled={loading}
            />
            {errors.email && (
              <p className="text-red-500 text-xs mt-1">{errors.email}</p>
            )}
          </div>

          <div className="flex gap-2 mb-4">
            <select 
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-gray-700 focus:outline-none focus:border-black"
              disabled={loading}
            >
              <option>+91</option>
            </select>

            <div className="flex-1">
              <input
                type="text"
                placeholder="Add your phone number *"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                className={`w-full border ${errors.phone ? 'border-red-500' : 'border-gray-200'} rounded-xl px-4 py-2.5 text-gray-700 focus:outline-none focus:border-black`}
                maxLength={10}
                disabled={loading}
              />
              {errors.phone && (
                <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
              )}
            </div>
          </div>

          <div className="mb-3">
            <input
              type="text"
              placeholder="Name *"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={`w-full border ${errors.name ? 'border-red-500' : 'border-gray-200'} rounded-xl px-4 py-2.5 text-gray-700 focus:outline-none focus:border-black`}
              disabled={loading}
            />
            {errors.name && (
              <p className="text-red-500 text-xs mt-1">{errors.name}</p>
            )}
          </div>

        {/* Discount Code */}
        {!appliedCoupon ? (
          !discountExpanded ? (
            <div
              onClick={() => setDiscountExpanded(true)}
              className="border border-gray-300 rounded-xl p-3 flex items-center justify-between cursor-pointer mb-4"
            >
              <div className="flex items-center gap-2">
                <span>🏷️</span>
                <span className="text-gray-700 font-medium">Have a Discount Code?</span>
                {availableCoupons.length > 0 && (
                  <span className="text-xs bg-indigo-100 text-indigo-700 font-semibold rounded-full px-2 py-0.5">
                    {availableCoupons.length} offer{availableCoupons.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <span className="text-indigo-600 font-medium">Add</span>
            </div>
          ) : (
            <div className="mb-4 border border-indigo-500 rounded-xl overflow-hidden">
              {/* Input row */}
              <div className="p-3 flex items-center justify-between">
                <input
                  type="text"
                  placeholder="Enter your discount code"
                  value={couponCode}
                  onChange={(e) => {
                    setCouponCode(e.target.value.toUpperCase())
                    setCouponError('')
                  }}
                  className="w-full outline-none text-gray-800"
                  disabled={applyingCoupon}
                />
                <button
                  onClick={() => handleApplyCoupon()}
                  disabled={applyingCoupon || !couponCode.trim()}
                  className="ml-3 text-indigo-600 font-semibold disabled:opacity-50"
                >
                  {applyingCoupon ? 'Applying...' : 'Apply'}
                </button>
              </div>

              {couponError && (
                <p className="text-red-500 text-xs px-3 pb-2 -mt-1">{couponError}</p>
              )}

              {/* Available offers list (inside the same field) */}
              {availableCoupons.length > 0 && (
                <div className="border-t border-gray-200 bg-gray-50">
                  <p className="text-gray-600 text-xs font-semibold uppercase tracking-wide px-3 pt-3 pb-2">
                    Available offers
                  </p>
                  <div className="flex flex-col divide-y divide-gray-200">
                    {availableCoupons.map((c) => (
                      <div
                        key={c.code}
                        className="px-3 py-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-lg">🏷️</span>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 tracking-wide truncate">
                              {c.code}
                            </div>
                            <div className="text-xs text-green-700">
                              Save ₹{c.discountAmount.toLocaleString('en-IN')} ({c.discountPercentage}% off)
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleApplyCoupon(c.code)}
                          disabled={applyingCoupon}
                          className="ml-3 text-indigo-600 font-semibold text-sm disabled:opacity-50 shrink-0"
                        >
                          {applyingCoupon ? 'Applying…' : 'Apply'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {loadingAvailableCoupons && availableCoupons.length === 0 && (
                <div className="border-t border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                  Loading available offers…
                </div>
              )}
            </div>
          )
        ) : (
          <div className="border border-green-500 bg-green-50 rounded-xl p-3 flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span>✓</span>
              <div>
                <span className="text-gray-700 font-medium">{appliedCoupon.code}</span>
                <span className="text-green-600 text-sm ml-2">
                  {appliedCoupon.discountPercentage}% off applied
                </span>
              </div>
            </div>
            <button 
              onClick={handleRemoveCoupon}
              className="text-red-600 font-medium text-sm"
            >
              Remove
            </button>
          </div>
        )}

        {/* Pricing */}
        <div className="flex justify-between text-gray-700 mb-2 text-sm">
          <span>Sub Total</span>
          <span>
            ₹{PRICING.MEMBERSHIP_FEE.toLocaleString('en-IN')}
            <span className="line-through text-gray-400 ml-2">₹{PRICING.ORIGINAL_PRICE.toLocaleString('en-IN')}</span>
          </span>
        </div>

        {appliedCoupon && (
          <div className="flex justify-between text-green-600 mb-2 text-sm">
            <span>Discount ({appliedCoupon.discountPercentage}%)</span>
            <span>-₹{appliedCoupon.discountAmount.toLocaleString('en-IN')}</span>
          </div>
        )}

        <hr className="my-3" />

        <div className="flex justify-between text-lg font-semibold text-gray-900 mb-6">
          <span>Total</span>
          <span>
            ₹{(appliedCoupon ? appliedCoupon.discountedAmount : PRICING.MEMBERSHIP_FEE).toLocaleString('en-IN')}
          </span>
        </div>

        {/* Payment Button */}
        <button 
          onClick={handlePayment}
          disabled={loading || !razorpayLoaded}
          className={`w-full bg-black text-white rounded-lg py-3 text-base font-semibold flex items-center justify-center gap-2 ${
            loading || !razorpayLoaded ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-800'
          }`}
        >
          {loading ? (
            <>
              <span className="animate-spin">⏳</span>
              Processing...
            </>
          ) : !razorpayLoaded ? (
            <>
              <span>Loading Payment Gateway...</span>
            </>
          ) : (
            <>
              Join Virtual Library
              <span className="text-xl">→</span>
            </>
          )}
        </button>

        {/* Terms */}
        <p className="text-gray-600 text-sm mt-4 leading-relaxed">
          By continuing, you agree to our{' '}
          <a
            href="/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[#a78bfa]"
          >
            Privacy policy
          </a>
          ,{' '}
          <a
            href="/refund-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[#a78bfa]"
          >
            Refund policy
          </a>
          , and{' '}
          <a
            href="/terms-and-conditions"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[#a78bfa]"
          >
            Terms & Conditions
          </a>
          .
        </p>
      </div>
    </section>
    </>
  )
}
