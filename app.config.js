const appJson = require("./app.json");

const baseConfig = appJson.expo;

function normalizeUrl(value) {
  if (!value || typeof value !== "string") return "";
  return value.trim().replace(/\/+$/, "");
}

module.exports = ({ config }) => {
  const buildProfile = process.env.EAS_BUILD_PROFILE || "";
  const appEnv = process.env.APP_ENV || "";

  const fromEnv = normalizeUrl(process.env.EXPO_PUBLIC_BACKEND_URL);
  const fromJson = normalizeUrl(baseConfig?.extra?.backendUrl);
  const backendUrl = fromEnv || fromJson;

  const isProductionLike = buildProfile === "production" || appEnv === "production";

  if (isProductionLike) {
    const isHttps = /^https:\/\//i.test(backendUrl);
    const hasPlaceholder = /example\.com/i.test(backendUrl);

    if (!backendUrl || !isHttps || hasPlaceholder) {
      throw new Error(
        "Production build blocked: set EXPO_PUBLIC_BACKEND_URL to your real public HTTPS API URL."
      );
    }
  }

  return {
    ...baseConfig,
    ...config,
    extra: {
      ...(baseConfig.extra || {}),
      ...(config.extra || {}),
      backendUrl,
      appEnv,
      easBuildProfile: buildProfile,
    },
  };
};
