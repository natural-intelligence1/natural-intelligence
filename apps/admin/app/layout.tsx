import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Natural Intelligence — Admin",
  description: "Admin portal",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
