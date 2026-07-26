/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/agrilearn-ai',
  async redirects() {
    return [
      {
        source: '/',
        destination: '/agrilearn-ai',
        permanent: false,
        basePath: false,
      },
      {
        source: '/login',
        destination: '/agrilearn-ai/login',
        permanent: false,
        basePath: false,
      },
      {
        source: '/register',
        destination: '/agrilearn-ai/register',
        permanent: false,
        basePath: false,
      },
      {
        source: '/dashboard',
        destination: '/agrilearn-ai/dashboard',
        permanent: false,
        basePath: false,
      },
    ];
  },
};

export default nextConfig;
