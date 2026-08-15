import { execSync } from "node:child_process";
import type { NextConfig } from "next";

/** Short git hash of the commit this build was made from ("" when not in a git repo). */
function gitShortHash(): string {
  try {
    return (
      execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
        .toString()
        .trim() ?? ""
    );
  } catch {
    return "";
  }
}

const nextConfig: NextConfig = {
  // Real build telemetry, baked at build time: the exact commit this bundle
  // was built from and when. Powers the terminal `status` panel — never
  // fabricated numbers.
  env: {
    NEXT_PUBLIC_BUILD_COMMIT: gitShortHash(),
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
};

export default nextConfig;
