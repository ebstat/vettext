import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ffmpeg-static resolveert het pad naar zijn binary zelf via __dirname; als Next
  // dit pakket meebundelt (Turbopack/webpack tracing), raakt dat pad corrupt
  // (spawn ...\ROOT\...\ffmpeg.exe ENOENT). Houd het dus als plain require buiten de bundle.
  serverExternalPackages: ["ffmpeg-static"],
};

export default nextConfig;
