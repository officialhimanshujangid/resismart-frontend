import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../context/AuthContext";
import { MuiThemeProvider } from "../context/MuiThemeProvider";
import { ToastConfirmProvider } from "../context/ToastConfirmContext";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Resismart - Society & Shop Management Platform",
  description: "Secure, multi-tenant digital management portal for residential societies, commercial shops, and committee admin actions.",
  icons: {
    icon: "/favicon.svg",
    apple: "/resismart-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} h-full antialiased font-sans`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AppRouterCacheProvider>
          <AuthProvider>
            <MuiThemeProvider>
              <ToastConfirmProvider>
                {children}
              </ToastConfirmProvider>
            </MuiThemeProvider>
          </AuthProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
