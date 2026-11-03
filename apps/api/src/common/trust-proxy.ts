// Only a plain positive integer counts. Number() would also accept "1e3" (1000
// hops, which trusts every proxy and lets the client forge its IP), "0x2" and
// " 2 ".
export function parseTrustProxy(value: string | undefined): number | undefined {
  return value !== undefined && /^[1-9]\d*$/.test(value)
    ? Number(value)
    : undefined;
}
