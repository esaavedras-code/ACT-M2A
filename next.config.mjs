/** @type {import('next').NextConfig} */
const nextConfig = {
    output: process.env.BUILD_FOR === 'electron' ? 'export' : undefined,
    images: {
        unoptimized: true,
    },
};

export default nextConfig;
