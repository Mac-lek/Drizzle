export type Kobo = bigint;

export const toKobo = (nairaAmount: number): Kobo => BigInt(Math.round(nairaAmount * 100));

export const toNaira = (kobo: Kobo): number => Number(kobo) / 100;

export const formatNaira = (kobo: Kobo): string => {
  const n = toNaira(kobo);
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
};

// JSON cannot serialize BigInt natively — call this at API boundary
export const koboToString = (kobo: Kobo): string => kobo.toString();

export const stringToKobo = (value: string): Kobo => BigInt(value);
