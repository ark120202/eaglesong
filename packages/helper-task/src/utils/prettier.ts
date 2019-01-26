import LinesAndColumns from 'lines-and-columns';
import prettier from 'prettier';
import { generateDifferences, showInvisibles } from 'prettier-linter-helpers';

export const prettierSupportedLanguages = prettier.getSupportInfo().languages;
export async function getPrettierErrors(filePath: string, fileContent: string) {
  const lines = new LinesAndColumns(fileContent);
  const options = await prettier.resolveConfig(filePath);
  let formatted: string;
  try {
    formatted = prettier.format(fileContent, { ...options, filepath: filePath });
  } catch {
    // Syntax Error would be handled by main parser
    return [];
  }

  return generateDifferences(fileContent, formatted).map(difference => {
    const insertText = showInvisibles(difference.insertText != null ? difference.insertText : '');
    const deleteText = showInvisibles(difference.deleteText != null ? difference.deleteText : '');
    const { line, column } = lines.locationForIndex(difference.offset)!;

    switch (difference.operation) {
      case 'insert':
        return `(${line}:${column}) Insert \`${insertText}\``;
      case 'delete':
        return `(${line}:${column}) Delete \`${deleteText}\``;
      case 'replace':
        return `(${line}:${column}) Replace \`${deleteText}\` with \`${insertText}\``;
    }
  });
}
