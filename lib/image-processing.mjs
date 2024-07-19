// lib/image-processing.mjs
import sharp from "sharp";

export async function processImage(buffer) {
  const image = sharp(buffer);
  const metadata = await image.metadata();

  if (metadata.width > 1568 || metadata.height > 1568) {
    image.resize(1568, 1568, { fit: "inside" });
  }

  return image.toBuffer();
}

export function encodeImageToBase64(buffer) {
  return buffer.toString("base64");
}

export function calculateImageTokens(width, height) {
  return Math.ceil((width * height) / 750);
}
