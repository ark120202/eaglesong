// https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/eslint-plugin-prettier/index.d.ts
declare module 'prettier-linter-helpers' {
  /**
   * Converts invisible characters to a commonly recognizable visible form.
   * @param str The string with invisibles to convert.
   */
  export function showInvisibles(str: string): string;

  /**
   * Generate results for differences between source code and formatted version.
   * @param source The original source.
   * @param formatted The formatted source.
   */
  export function generateDifferences(source: string, formatted: string): Difference[];

  export interface Difference {
    operation: 'insert' | 'delete' | 'replace';
    offset: number;
    insertText?: string;
    deleteText?: string;
  }
}
