import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Head from 'next/head'
import Header from '@/components/Header'

export default function PaymentSuccess() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userDetails, setUserDetails] = useState<{
    name: string
    email: string
    phone: string
  } | null>(null)
  const [paymentDetails, setPaymentDetails] = useState<{
    amount: number
    currency: string
    examType: string
  } | null>(null)

  useEffect(() => {
    const validateSession = async () => {
      const { token } = router.query
      
      if (!token) {
        // No token provided, redirect to home
        router.replace('/')
        return
      }

      try {
        // Validate the token with backend
        const response = await fetch('/api/payment/validate-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        })

        const data = await response.json()

        if (!response.ok || !data.data?.valid) {
          // Invalid token, redirect to home
          router.replace('/')
          return
        }

        // Valid session, set user details and payment details
        setUserDetails(data.data.userDetails)
        setPaymentDetails(data.data.paymentDetails)
        
        // Track Purchase event for Meta Pixel
      if (typeof window !== 'undefined' && window.fbq && data.data.paymentDetails) {
          window.fbq('track', 'Purchase', {
            content_name: 'Virtual Library Membership',
            content_category: data.data.paymentDetails?.examType || 'NEET-PG',
            value: data.data.paymentDetails?.amount / 100 || 0, // Convert paise to rupees
            currency: data.data.paymentDetails?.currency || 'INR',
          });
        }
        
        setLoading(false)
      } catch (error) {
        console.error('Error validating session:', error)
        router.replace('/')
      }
    }

    if (router.isReady) {
      validateSession()
    }
  }, [router, router.isReady, router.query])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying payment...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Payment Successful - Virtual Library</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50">
        <Header />
        
        {/* Main Content with padding for fixed header */}
        <div className="pt-24 pb-8 px-4 min-h-screen flex items-center justify-center">
          <div className="w-full max-w-3xl">
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
              {/* Header Section */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-8 text-center border-b">
                {/* Success Icon */}
                <div className="mb-4 flex justify-center">
                  <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                    <svg
                      className="w-10 h-10 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                </div>

                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                  Payment Successful! 🎉
                </h1>
                <p className="text-base text-gray-600">
                  Welcome to Virtual Library, {userDetails?.name || 'there'}!
                </p>
              </div>

              {/* Content Section - Scrollable */}
              <div className="p-8 space-y-6 overflow-y-auto flex-1">
                {/* Confirmation Details */}
                {userDetails && (
                  <div className="bg-gray-50 rounded-lg p-6">
                    <div className="flex items-center mb-3">
                      <svg
                        className="w-5 h-5 mr-2 text-green-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <h2 className="font-semibold text-gray-900 text-lg">Confirmation Sent To:</h2>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">📧 {userDetails.email}</p>
                    <p className="text-sm text-gray-600">📱 +91 {userDetails.phone}</p>
                  </div>
                )}

                {/* Next Steps */}
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-6">
                  <h2 className="font-semibold text-gray-900 mb-4 text-lg">📋 Next Steps:</h2>
                  <ol className="space-y-3 text-sm text-gray-700">
                    <li className="flex items-start">
                      <span className="font-bold text-indigo-600 mr-3 text-lg min-w-[24px]">1.</span>
                      <span>Check your email for the payment receipt and confirmation details</span>
                    </li>
                    <li className="flex items-start">
                      <span className="font-bold text-indigo-600 mr-3 text-lg min-w-[24px]">2.</span>
                      <span>
                        WhatsApp a screenshot of this page to{' '}
                        <a
                          href="https://wa.me/917974425107"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-indigo-600 hover:underline"
                        >
                          +91 79744 25107
                        </a>
                      </span>
                    </li>
                    <li className="flex items-start">
                      <span className="font-bold text-indigo-600 mr-3 text-lg min-w-[24px]">3.</span>
                      <span>You will be added to the respective groups within 4-6 hours</span>
                    </li>
                    <li className="flex items-start">
                      <span className="font-bold text-indigo-600 mr-3 text-lg min-w-[24px]">4.</span>
                      <span>Access details and instructions will be shared in the groups</span>
                    </li>
                  </ol>
                </div>

                {/* What You Get */}
                <div className="bg-gray-900 text-white rounded-lg p-6">
                  <h2 className="font-semibold mb-4 text-lg flex items-center">
                    🎁 What You're Getting:
                  </h2>
                  <ul className="space-y-2.5 text-sm">
                    <li className="flex items-start">
                      <span className="text-green-400 mr-3 text-lg">✓</span>
                      <span>24/7 Virtual Study Space Access</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-400 mr-3 text-lg">✓</span>
                      <span>Exam-Specific WhatsApp & Telegram Groups</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-400 mr-3 text-lg">✓</span>
                      <span>Expert-Led Mental Health Sessions</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-400 mr-3 text-lg">✓</span>
                      <span>Daily Rankings & Progress Tracking</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-400 mr-3 text-lg">✓</span>
                      <span>Forest Study Groups for Focused Learning</span>
                    </li>
                  </ul>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <a
                    href="https://wa.me/917974425107"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                    </svg>
                    Contact on WhatsApp
                  </a>
                  <button
                    onClick={() => router.push('/')}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold py-3 px-6 rounded-lg transition-colors"
                  >
                    Back to Home
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

