import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: "export", // Enables static HTML export
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    }
};

export default nextConfig;
