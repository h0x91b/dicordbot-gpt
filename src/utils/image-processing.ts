import sharp from "sharp";

export async function processImage(buffer: Buffer): Promise<Buffer> {
  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();

    if ((metadata.width || 0) > 1568 || (metadata.height || 0) > 1568) {
      image.resize(1568, 1568, { fit: "inside" });
    }

    return image.toBuffer();
  } catch (error) {
    console.error("Error processing image:", error);
    throw new Error("Unsupported image format");
  }
}

export function encodeImageToBase64(buffer: Buffer): string {
  return buffer.toString("base64");
}

export function calculateImageTokens(width: number, height: number): number {
  return Math.ceil((width * height) / 750);
}
