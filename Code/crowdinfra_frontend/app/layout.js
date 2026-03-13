'use client'
import { Geist, Geist_Mono } from 'next/font/google'
import 'tailwindcss/tailwind.css'

import './globals.css'
import { UserProvider } from './components/user_context'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import ClickSpark from './components/ui/ClickSpark'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export default function RootLayout({ children }) {
  return (
    <html lang='en' style={{ maxWidth: '100vw', overflowX: 'hidden' }}>
      <head>
        <link rel='icon' href='/favicon.ico' sizes='any' />

        <link rel='apple-touch-icon' href='/apple-touch-icon.png' />
        <link rel='manifest' href='/site.webmanifest' />
        <meta name='viewport' content='width=device-width, initial-scale=1.0' />
        <meta name='description' content='CrowdInfra - Your Crowd-Driven Infrastructure.' />
        <meta name='theme-color' content='#000000' />

        <title>CrowdInfra</title>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <UserProvider>
          <ClickSpark
            sparkColor='#fff'
            sparkSize={10}
            sparkRadius={15}
            sparkCount={8}
            duration={400}
          >
          <ToastContainer position='top-right' autoClose={3000} />
          {children}
          </ClickSpark>
        </UserProvider>
      </body>
    </html>
  )
}
