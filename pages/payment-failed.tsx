import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Head from 'next/head'
import Header from '@/components/Header'

export default function PaymentFailed() {
  const router = useRouter()
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [paymentDetails, setPaymentDetails] = useState<{
    amount: number
    examType: string
  } | null>(null)

  useEffect(() => {
    // Get error message and payment details from query params
    const { error, amount, examType } = router.query
    
    // If no error message provided, redirect to home
    if (router.isReady && !error) {
      router.replace('/')
      return
    }
    
    if (error) {
      setErrorMessage(error as string)
    }

    // Set payment details if available
    if (amount && examType) {
      setPaymentDetails({
        amount: parseFloat(amount as string),
        examType: examType as string
      })
    }
  }, [router, router.isReady, router.query])

  return (
    <>
      <Head>
        <title>Payment Failed - Virtual Library</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50">
        <Header />
        
        {/* Main Content with padding for fixed header */}
        <div className="pt-24 pb-8 px-4 min-h-screen flex items-center justify-center">
          <div className="w-full max-w-3xl">
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
              {/* Header Section */}
              <div className="bg-gradient-to-br from-red-50 to-orange-50 p-8 text-center border-b">
                {/* Error Icon */}
                <div className="mb-4 flex justify-center">
                  <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </div>
                </div>

                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                  Payment Failed
                </h1>
                <p className="text-base text-gray-600">
                  {errorMessage || "We couldn't process your payment"}
                </p>
              </div>

              {/* Content Section - Scrollable */}
              <div className="p-8 space-y-6 overflow-y-auto flex-1">
                {/* Payment Details */}
                {paymentDetails && (
                  <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg p-6 border-2 border-red-200">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="font-semibold text-gray-900 text-lg flex items-center">
                        <svg
                          className="w-5 h-5 mr-2 text-red-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        Attempted Payment Details
                      </h2>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Amount Attempted:</span>
                        <span className="text-xl font-bold text-gray-900">
                          ₹{paymentDetails.amount.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Exam Type:</span>
                        <span className="text-sm font-semibold text-gray-900">
                          {paymentDetails.examType === 'neet-pg' ? 'NEET-PG' : 
                           paymentDetails.examType === 'other-exams' ? 'Other Exams' : 
                           paymentDetails.examType}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-red-200">
                      <p className="text-xs text-gray-600">
                        ⚠️ No money has been deducted from your account
                      </p>
                    </div>
                  </div>
                )}

                {/* Common Reasons */}
                <div className="bg-red-50 rounded-lg p-6">
                  <h2 className="font-semibold text-gray-900 mb-4 text-lg">
                    🔍 Common Reasons for Payment Failure:
                  </h2>
                  <ul className="space-y-2.5 text-sm text-gray-700">
                    <li className="flex items-start">
                      <span className="text-red-600 mr-3 text-lg mt-0.5">•</span>
                      <span>Insufficient balance in your account</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-red-600 mr-3 text-lg mt-0.5">•</span>
                      <span>Incorrect card details or expired card</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-red-600 mr-3 text-lg mt-0.5">•</span>
                      <span>Transaction limit exceeded on your card</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-red-600 mr-3 text-lg mt-0.5">•</span>
                      <span>Bank declined the transaction for security reasons</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-red-600 mr-3 text-lg mt-0.5">•</span>
                      <span>Network connectivity issues during payment</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-red-600 mr-3 text-lg mt-0.5">•</span>
                      <span>Payment session timed out</span>
                    </li>
                  </ul>
                </div>

                {/* What to Do Next */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6">
                  <h2 className="font-semibold text-gray-900 mb-4 text-lg">
                    💡 What to Do Next:
                  </h2>
                  <ol className="space-y-3 text-sm text-gray-700">
                    <li className="flex items-start">
                      <span className="font-bold text-indigo-600 mr-3 text-lg min-w-[24px]">1.</span>
                      <span>Check your bank account balance and card details</span>
                    </li>
                    <li className="flex items-start">
                      <span className="font-bold text-indigo-600 mr-3 text-lg min-w-[24px]">2.</span>
                      <span>Ensure your internet connection is stable</span>
                    </li>
                    <li className="flex items-start">
                      <span className="font-bold text-indigo-600 mr-3 text-lg min-w-[24px]">3.</span>
                      <span>Try using a different payment method (Card/UPI/Net Banking)</span>
                    </li>
                    <li className="flex items-start">
                      <span className="font-bold text-indigo-600 mr-3 text-lg min-w-[24px]">4.</span>
                      <span>Contact your bank if the issue persists</span>
                    </li>
                  </ol>
                </div>

                {/* Help Section */}
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-6">
                  <h2 className="font-semibold text-gray-900 mb-3 text-lg">
                    💬 Need Help?
                  </h2>
                  <p className="text-sm text-gray-700 mb-4">
                    If you continue to face issues or have questions about your payment, our team is here to help:
                  </p>
                  <div className="space-y-3">
                    <a
                      href="https://wa.me/917974425107"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center text-green-600 hover:text-green-700 font-semibold text-sm"
                    >
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                      </svg>
                      WhatsApp: +91 79744 25107
                    </a>
                    <p className="flex items-center text-gray-600 text-sm">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      We'll help you complete the payment
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <button
                    onClick={() => router.push('/')}
                    className="flex-1 bg-black hover:bg-gray-800 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                  >
                    Try Again
                  </button>
                  <a
                    href="https://wa.me/917974425107"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                    </svg>
                    Get Help
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

