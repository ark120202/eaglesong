declare module 'webpack/lib/SingleEntryPlugin';

declare module 'unique-string' {
  /**
   * Returns a 32 character unique string. Matches the length of MD5,
   * which is unique enough for non-crypto purposes.
   */
  export default function uniqueString(): string;
}
