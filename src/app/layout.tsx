import type { Metadata } from "next";
import { Inter, DM_Serif_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-heading",
});

import { AuthProvider } from '@/context/AuthContext';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: "Dayo",
  description: "Your day, sorted.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#6366F1" />
        <script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" defer></script>
      </head>
      <body
        className={`${inter.variable} ${dmSerif.variable} font-sans bg-[#FAFAF8] text-[#1A1A2E] antialiased min-h-[100dvh]`}
        suppressHydrationWarning
      >
        <AuthProvider>
          {children}
          <Toaster 
            position="bottom-center" 
            toastOptions={{ 
              style: { background: '#1A1A2E', color: '#FAFAF8', borderRadius: '12px', fontSize: '13px' } 
            }} 
          />
        </AuthProvider>
      </body>
    </html>
  );
}

