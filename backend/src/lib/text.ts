import { z } from "zod";

// Small helpers for text people type. Everything a person enters can end up in a
// prompt, a notification or a log line, so control characters and fake line
// breaks are removed before it is stored.

// Control and format characters (zero-width, bidi overrides), except tab and newline.
const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F​-‏‪-‮⁠-⁤﻿]/g;

/** Keeps line breaks (notes, journal entries, chat messages) but drops other control characters. */
export function cleanMultiline(text: string): string {
  return text.replace(/\r\n?/g, "\n").replace(CONTROL, "").trim();
}

/** One line of plain text: names, titles, emotion words, reminder text. */
export function oneLine(text: string): string {
  return text.replace(CONTROL, " ").replace(/\s+/g, " ").trim();
}

/** A trimmed single-line string field with a length cap (applied after cleaning). */
export const lineField = (max: number) => z.string().transform(oneLine).pipe(z.string().max(max));

/** A multi-line text field with a length cap (applied after cleaning). */
export const textField = (max: number) => z.string().transform(cleanMultiline).pipe(z.string().max(max));

export const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** Removes the given XML-style tag names from text so it can't close or forge a tagged block in a prompt. */
export function stripTags(text: string, tags: string[]): string {
  if (!tags.length) return text;
  return text.replace(new RegExp(`</?\\s*(${tags.join("|")})\\b[^>]*>`, "gi"), "");
}
