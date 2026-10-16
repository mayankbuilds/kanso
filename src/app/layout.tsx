import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kanso",
  description: "Calm, intentional productivity and progress tracker.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "32x32" },
      { url: "/icons/icon-192x192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512x512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Kanso",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#090909" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased min-h-screen">
        <Script id="theme-init" strategy="beforeInteractive">
          {`
            try {
              var savedMode = localStorage.getItem("kanso_theme_mode") || localStorage.getItem("streakflow_theme_mode") || "system";
              var isDark = savedMode === "dark" || (savedMode === "system" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
              var resolved = isDark ? "dark" : "light";

              var accent = localStorage.getItem("kanso_accent_color") || localStorage.getItem("streakflow_accent_color") || "pine";
              if (accent === "emerald") accent = "pine";
              if (accent === "cyan") accent = "ceramic";
              if (accent === "amber") accent = "sand";
              if (accent === "purple" || accent === "rose") accent = "clay";

              document.documentElement.className = resolved;
              document.documentElement.setAttribute("data-theme", resolved);
              document.documentElement.setAttribute("data-theme-preference", savedMode);
              document.documentElement.setAttribute("data-accent", accent);
            } catch (e) {}
          `}
        </Script>
        {children}
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="beforeInteractive"
        />
      </body>
    </html>
  );
}
