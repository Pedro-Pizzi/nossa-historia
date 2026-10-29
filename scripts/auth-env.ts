/** O Next expande $VAR no .env: hashes scrypt precisam escapar cada cifrão. */
export function dotenvValue(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\$/g, "\\$").replace(/\r/g,"\\r").replace(/\n/g,"\\n")}"`;
}
export function mergeAuthEnvironment(existing: string, values: Record<string, string>) {
  const keys = new Set(Object.keys(values));
  const retained = existing.split(/\r?\n/).filter((line) => {
    const key = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=/)?.[1];
    return !key || !keys.has(key);
  }).join("\n").trimEnd();
  return (retained ? retained + "\n\n" : "") + Object.entries(values).map(([key, value]) => `${key}=${dotenvValue(value)}`).join("\n") + "\n";
}
