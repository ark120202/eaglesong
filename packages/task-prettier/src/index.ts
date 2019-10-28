import { TransformTask } from '@eaglesong/helper-task';
import fs from 'fs-extra';
import LinesAndColumns from 'lines-and-columns';
import prettier from 'prettier';
import { generateDifferences, showInvisibles } from 'prettier-linter-helpers';

interface PrettierErrorLocation {
  start: { line: number; column: number };
}

interface PrettierSyntaxError extends SyntaxError {
  loc: PrettierErrorLocation;
  codeFrame?: string;
}

const isPrettierSyntaxError = (error: unknown): error is PrettierSyntaxError =>
  error instanceof SyntaxError && 'loc' in error;

const { languages } = prettier.getSupportInfo();
const prettierPatterns = languages.flatMap(language => [
  ...(language.filenames || []).map(fileName => `**/${fileName}`),
  ...(language.extensions || []).map(extension => `**/*${extension}`),
]);

export default class PrettierTask extends TransformTask<void> {
  protected pattern = [...prettierPatterns, '!node_modules'];

  constructor() {
    super(undefined);
  }

  protected async transformFile(filePath: string) {
    const fileInfo = await prettier.getFileInfo(filePath, { ignorePath: '.prettierignore' });
    if (fileInfo.ignored) return;

    const fileContent = await fs.readFile(filePath, 'utf8');

    const lines = new LinesAndColumns(fileContent);
    const options = await prettier.resolveConfig(filePath);
    let formatted: string;
    try {
      formatted = prettier.format(fileContent, { ...options, filepath: filePath });
    } catch (error) {
      if (!isPrettierSyntaxError(error)) {
        throw error;
      }

      let message = `Parsing error: ${error.message}`;

      if (error.codeFrame) {
        message = message.replace(`\n${error.codeFrame}`, '');
      }

      message = message.replace(/ \(\d+:\d+\)$/, '');
      message = `(${error.loc.start.line}:${error.loc.start.column}) ${message}`;

      this.error(filePath, message);
      return;
    }

    for (const difference of generateDifferences(fileContent, formatted)) {
      const insertText = showInvisibles(difference.insertText != null ? difference.insertText : '');
      const deleteText = showInvisibles(difference.deleteText != null ? difference.deleteText : '');
      const { line, column } = lines.locationForIndex(difference.offset)!;
      const position = `(${line}:${column})`;

      switch (difference.operation) {
        case 'insert':
          this.error(filePath, `${position} Insert \`${insertText}\``);
          break;
        case 'delete':
          this.error(filePath, `${position} Delete \`${deleteText}\``);
          break;
        case 'replace':
          this.error(filePath, `${position} Replace \`${deleteText}\` with \`${insertText}\``);
          break;
      }
    }
  }
}
