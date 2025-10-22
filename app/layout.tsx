import './globals.css'
import type { Metadata } from 'next'
import { Roboto_Mono } from "next/font/google";
import { Providers } from './providers'
import Header from "./components/header/Header";
import Footer from "./components/footer/Footer";
import { Toaster } from 'react-hot-toast';
import { Analytics } from "@vercel/analytics/next"

const geistMono = Roboto_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'Playhead',
  description: 'A free online video editor that enables you to edit videos directly from your web browser.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body
        className={`min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans ${geistMono.variable} antialiased`}
      >
        <Providers>
          <Header />
          <main className="flex-grow">
            <Toaster
              toastOptions={{
                style: {
                  borderRadius: '10px',
                  background: '#333',
                  color: '#fff',
                },
              }}
            />
            {children}
            <Analytics />
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  )
}
