export function sanitize(text: string): string {
  return text
    .replace(/\bsk-[a-zA-Z0-9]{20,}\b/g, "<API_KEY>")
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, "<AWS_KEY>")
    .replace(/\beyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\b/g, "<JWT_TOKEN>")
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, "<IP_ADDRESS>")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "<EMAIL>")
    .replace(
      /(password|secret|api_key)(\s*[:=]\s*["'])([^"']+)(["'])/gi,
      (_match, key: string, prefix: string, _value: string, suffix: string) =>
        `${key}${prefix}<SECRET>${suffix}`,
    );
}
