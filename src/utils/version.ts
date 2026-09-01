/** Compare semver strings — returns true if current >= minimum */
export function isVersionSupported(current: string, minimum: string): boolean {
  const parse = (v: string) => v.split('.').map((n) => parseInt(n, 10) || 0);
  const [cMaj = 0, cMin = 0, cPat = 0] = parse(current);
  const [mMaj = 0, mMin = 0, mPat = 0] = parse(minimum);
  if (cMaj !== mMaj) return cMaj > mMaj;
  if (cMin !== mMin) return cMin > mMin;
  return cPat >= mPat;
}
