export function unixToISO(ts?: number): string | null {
  if (!ts) return null;
  try {
    return new Date(ts * 1000).toISOString();
  } catch {
    return null;
  }
}

export function formatUnixHuman(ts?: number): string | null {
  if (!ts) return null;
  try {
    return new Date(ts * 1000).toLocaleString();
  } catch {
    return null;
  }
}
