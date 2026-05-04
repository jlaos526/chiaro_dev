/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@chiaro/db', '@chiaro/profile', '@chiaro/supabase-client'],
}
export default nextConfig
