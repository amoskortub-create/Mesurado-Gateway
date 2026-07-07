/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/',
        destination: '/overview',
        permanent: false,
      },
    ];
  },
  // Silence during dev when Appwrite env vars are not yet set
  env: {
    NEXT_PUBLIC_APPWRITE_ENDPOINT: process.env.APPWRITE_ENDPOINT ?? '',
    NEXT_PUBLIC_APPWRITE_PROJECT_ID: process.env.APPWRITE_PROJECT_ID ?? '',
  },
};

module.exports = nextConfig;
