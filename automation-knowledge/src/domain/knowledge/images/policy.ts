export const DEFAULT_CANONICAL_IMAGE_MAX_WIDTH = 1920;
export const DEFAULT_CANONICAL_WEBP_EFFORT = 6;
export const DEFAULT_RUNTIME_WEBP_QUALITY = 88;

export const RUNTIME_IMAGE_DERIVATIVES = [
  { variant: "400", assetField: "optimized400", maxWidth: 400 },
  { variant: "1200", assetField: "optimized1200", maxWidth: 1200 },
  { variant: "2200", assetField: "optimized2200", maxWidth: 2200 },
] as const;

export const RUNTIME_IMAGE_VARIANT_NAMES = ["original", ...RUNTIME_IMAGE_DERIVATIVES.map((item) => item.variant)] as const;

export type CanonicalImagePolicy = {
  maxWidth: number;
  webpEffort: number;
};

export function createCanonicalImagePolicy(input: Partial<CanonicalImagePolicy> = {}): CanonicalImagePolicy {
  const maxWidth = input.maxWidth ?? DEFAULT_CANONICAL_IMAGE_MAX_WIDTH;
  const webpEffort = input.webpEffort ?? DEFAULT_CANONICAL_WEBP_EFFORT;
  if (!Number.isInteger(maxWidth) || maxWidth < 320) {
    throw new Error("Canonical image maxWidth must be an integer >= 320.");
  }
  if (!Number.isInteger(webpEffort) || webpEffort < 0 || webpEffort > 6) {
    throw new Error("Canonical WebP effort must be an integer between 0 and 6.");
  }
  return { maxWidth, webpEffort };
}

export function getRuntimeImageDerivative(variant: (typeof RUNTIME_IMAGE_DERIVATIVES)[number]["variant"]) {
  const policy = RUNTIME_IMAGE_DERIVATIVES.find((item) => item.variant === variant);
  if (!policy) throw new Error(`Unsupported runtime image variant: ${variant}`);
  return policy;
}
