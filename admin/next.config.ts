import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    // Signed Supabase Storage URLs are rendered with a plain <img>, not
    // next/image, so there is no remotePatterns list to keep in step with the
    // Supabase project ref. One less thing to break on a project migration.
};

export default nextConfig;
