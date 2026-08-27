import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'Upcheck feedback',
    description: 'Farmer issue reports',
    // Internal tool behind a Vercel deployment — keep it out of search results.
    robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>
                <main>{children}</main>
            </body>
        </html>
    );
}
