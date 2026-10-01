import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import type { CanonicalImagePolicy } from "../../../src/domain/knowledge/images/policy";
import { sha256File } from "./files";

export type CanonicalImageResult = {
  width?: number;
  height?: number;
  bytes: number;
  sha256: string;
};

export async function canonicalizeImage(input: string, output: string, policy: CanonicalImagePolicy): Promise<CanonicalImageResult> {
  const source = await readFile(input);
  const metadata = await sharp(source).metadata();
  let pipeline = sharp(source).rotate();
  if (metadata.width && metadata.width > policy.maxWidth) {
    pipeline = pipeline.resize({ width: policy.maxWidth, withoutEnlargement: true, fit: "inside" });
  }
  const { data, info } = await pipeline.webp({ lossless: true, effort: policy.webpEffort }).toBuffer({ resolveWithObject: true });
  await writeFile(output, data);
  return { width: info.width, height: info.height, bytes: data.length, sha256: await sha256File(output) };
}

export async function createRuntimeDerivative(
  input: string,
  output: string,
  maxWidth: number,
  quality: number,
  effort: number
) {
  const source = await readFile(input);
  const { data, info } = await sharp(source)
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true, fit: "inside" })
    .webp({ quality, effort })
    .toBuffer({ resolveWithObject: true });
  await writeFile(output, data);
  return { width: info.width, height: info.height, bytes: data.length };
}
