/** @type {import('next').NextConfig} */
const nextConfig = {
        output: process.env.BUILD_FOR === 'electron' ? 'export' : undefined,
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    images: {
        unoptimized: true,
    },
    webpack: (config, { isServer, webpack }) => {
        if (!isServer) {
            config.plugins.push(
                new webpack.IgnorePlugin({
                    resourceRegExp: /^(node:https|node:http|node:fs|node:path|node:os|https|http|fs|path|os|express)$/,
                })
            );
            config.resolve.alias = {
                ...config.resolve.alias,
                'node:https': false,
                'node:http': false,
                'node:fs': false,
                'node:path': false,
                'node:os': false,
            };
            config.resolve.fallback = {
                ...config.resolve.fallback,
                https: false,
                http: false,
                fs: false,
                path: false,
                os: false,
                express: false,
                'node:https': false,
                'node:http': false,
                'node:fs': false,
                'node:path': false,
            };
        }
        return config;
    },
};

export default nextConfig;
