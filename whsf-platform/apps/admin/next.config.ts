import type { NextConfig } from "next";
const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  transpilePackages: ["@whsf/aurora-ui", "@whsf/auth-sdk"],
};
export default config;
