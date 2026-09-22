/**
 * Normalizing a password as it is typed, pasted, and received by the server.
 *
 * Lesson from Koma: someone pastes the temporary password they were sent and is
 * told it is wrong, while the characters on screen are visibly correct. Two
 * causes:
 *
 *   1. Invisible characters. Text copied from a chat, a PDF or an RTL page
 *      carries formatting marks that render as nothing: bidi marks (U+200E/F,
 *      U+061C), embeddings/isolates (U+202A–E, U+2066–9), zero-width space,
 *      BOM. The hash compares bytes, so "abc\u200f" is a different password.
 *   2. Edge whitespace from selecting one character too many.
 *
 * The SAME function runs in the browser (so the value shown, validated and
 * submitted is one string) and on the server (so an API client gets the same
 * treatment).
 *
 * Deliberately NOT removed: U+200C / U+200D (zero-width non-joiner / joiner).
 * They are structural — U+200D holds 👨\u200d👩\u200d👧 together — and stripping them turns
 * one password into another, which is the failure this module exists to stop.
 * Internal spaces are kept: a passphrase with spaces is a legitimate password.
 *
 * NFC normalization makes a precomposed and a decomposed form of the same
 * visible character (common with niqqud or accented Latin across keyboards)
 * the same password. It never changes what the person sees.
 */

const FORMATTING_CHARACTERS = /[\u200b\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069\ufeff]/g;
const EDGE_WHITESPACE = /^[\s\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]+|[\s\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]+$/g;

export function normalizePasswordInput(value: string): string {
  return value.replace(FORMATTING_CHARACTERS, '').replace(EDGE_WHITESPACE, '').normalize('NFC');
}

export function wouldNormalizePassword(value: string): boolean {
  return normalizePasswordInput(value) !== value;
}
