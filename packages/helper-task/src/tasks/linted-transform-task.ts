import fs from 'fs-extra';
import path from 'upath';
import { getPrettierErrors, prettierSupportedLanguages } from '../utils';
import { TransformTask } from './transform-task';

export abstract class LintedTransformTask<T> extends TransformTask<T> {
  protected async transformFile(filePath: string) {
    const baseName = path.parse(filePath).base;
    const extension = path.extname(filePath);
    const isSupported = prettierSupportedLanguages.some(
      x =>
        x.extensions.includes(extension) || (x.filenames != null && x.filenames.includes(baseName)),
    );

    if (isSupported) {
      const fileContent = await fs.readFile(filePath, 'utf8');
      const errors = await getPrettierErrors(filePath, fileContent);
      errors.forEach(errorText => this.error(filePath, errorText));
    }
  }
}
