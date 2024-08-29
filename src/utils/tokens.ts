import { encode, decode } from "gpt-3-encoder";

export function calculateTokens(text: string): number {
  const tokens = encode(text);
  return tokens.length;
}

export function limitTokens(text: string, maxTokens: number): string {
  const tokens = encode(text);
  const limitedTokens = tokens.slice(tokens.length - maxTokens, tokens.length);
  return decode(limitedTokens);
}
