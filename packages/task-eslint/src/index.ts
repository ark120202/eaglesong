import { TransformTask } from '@eaglesong/helper-task';
import { CLIEngine } from 'eslint';

export interface Options {
  extensions?: string[];
}

export default class ESLintTask extends TransformTask<Options> {
  private readonly extensions = this.options.extensions || ['.js', '.jsx', '.ts', '.tsx'];
  private readonly cliEngine = new CLIEngine({ extensions: this.extensions });
  protected pattern = [`**/*{${this.extensions.join(',')}}`, '!node_modules'];

  constructor(options: Options = {}) {
    super(options);
  }

  protected afterWatch() {
    const { results } = this.cliEngine.executeOnFiles(['.']);
    for (const { filePath, messages } of results) {
      for (const { severity, line, column, message } of messages) {
        if (severity !== 0) {
          const fullMessage = `(${line},${column}) ${message}`;
          const level = severity === 2 ? 'error' : 'warning';

          this.error({ filePath, level, message: fullMessage });
        }
      }
    }
  }
}
