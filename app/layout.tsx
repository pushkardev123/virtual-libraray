import '@/styles/globals.css'
import type { ReactNode } from 'react'
import { Outfit } from 'next/font/google'

const outfit = Outfit({ subsets: ['latin'] })

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={outfit.className}>{children}</body>
    </html>
  )
}
