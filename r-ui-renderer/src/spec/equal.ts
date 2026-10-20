/** Records with the same own keys holding the same values (`Object.is`), one level deep. */
export function sameEntries(a: object, b: object): boolean {
  const aRecord = a as Readonly<Record<string, unknown>>;
  const bRecord = b as Readonly<Record<string, unknown>>;
  const keys = Object.keys(aRecord);
  return keys.length === Object.keys(bRecord).length && keys.every((key) => Object.hasOwn(bRecord, key) && Object.is(aRecord[key], bRecord[key]));
}
