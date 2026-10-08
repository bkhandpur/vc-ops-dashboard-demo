export function safeSampleLink(value: string | null | undefined): string | undefined {
  if (!value || /(?:[.@/]|^)example(?:[/:]|$)/i.test(value)) return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:", "mailto:"].includes(url.protocol) ? value : undefined;
  } catch {
    return undefined;
  }
}
