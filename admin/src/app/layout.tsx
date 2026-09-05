import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
    title: 'Upcheck admin',
    description: 'Farmer issue reports and app announcements',
    // Internal tool behind a Vercel deployment — keep it out of search results.
    robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>
                <nav className="top-nav">
                    <Link href="/">Feedback</Link>
                    <Link href="/announcements">Announcements</Link>
                </nav>
                <main>{children}</main>
            </body>
        </html>
    );
}
