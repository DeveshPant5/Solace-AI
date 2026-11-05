import { fetch as expoFetch } from 'expo/fetch';
import { Platform } from 'react-native';

import { API_URL, ApiError, authHeaders } from './api';

export type StreamHandler = (event: string, data: any) => void;

function utf8Decoder() {
  if (typeof TextDecoder !== 'undefined') {
    const d = new TextDecoder();
    return (chunk: Uint8Array) => d.decode(chunk, { stream: true });
  }
  // Minimal streaming UTF-8 decoder for runtimes without TextDecoder.
  let pending: number[] = [];
  return (chunk: Uint8Array) => {
    const bytes = pending.concat(Array.from(chunk));
    let out = '';
    let i = 0;
    while (i < bytes.length) {
      const b = bytes[i]!;
      const len = b < 0x80 ? 1 : b >= 0xf0 ? 4 : b >= 0xe0 ? 3 : 2;
      if (i + len > bytes.length) break;
      let cp = len === 1 ? b : b & (0xff >> (len + 1));
      for (let k = 1; k < len; k++) cp = (cp << 6) | (bytes[i + k]! & 0x3f);
      out += String.fromCodePoint(cp);
      i += len;
    }
    pending = bytes.slice(i);
    return out;
  };
}

/**
 * Sends a chat message and reads Sol's reply as Server-Sent Events.
 * Resolves when the stream ends.
 */
export async function streamChat(conversationId: string, content: string, onEvent: StreamHandler, signal?: AbortSignal) {
  const doFetch = (Platform.OS === 'web' ? globalThis.fetch : expoFetch) as typeof globalThis.fetch;
  let response: Response;
  try {
    response = await doFetch(`${API_URL}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...authHeaders() },
      body: JSON.stringify({ content }),
      signal,
    });
  } catch {
    throw new ApiError(0, "Can't reach Sol right now. Check your connection and try again.", 'network');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(response.status, data?.error?.message ?? 'Sol couldn’t reply just now.', data?.error?.code ?? 'error');
  }

  const dispatch = (block: string) => {
    let event = 'message';
    const dataLines: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }
    if (!dataLines.length) return;
    try {
      onEvent(event, JSON.parse(dataLines.join('\n')));
    } catch {
      // ignore malformed event
    }
  };

  const body = response.body;
  if (!body) {
    // No streaming support: parse the whole response at once.
    const text = await response.text();
    text.split(/\r?\n\r?\n/).forEach(dispatch);
    return;
  }
  const reader = body.getReader();
  const decode = utf8Decoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decode(value).replace(/\r\n/g, '\n');
    let split = buffer.indexOf('\n\n');
    while (split !== -1) {
      dispatch(buffer.slice(0, split));
      buffer = buffer.slice(split + 2);
      split = buffer.indexOf('\n\n');
    }
  }
  if (buffer.trim()) dispatch(buffer);
}
