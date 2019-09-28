import { TransformTask } from '@eaglesong/helper-task';
import { CLIEngine } from 'eslint';

export default class ESLintTask extends TransformTask<void> {
  protected pattern = ['**/*.{js,jsx,ts,tsx}', '!node_modules'];

  constructor() {
    super(undefined);
  }

  private readonly cliEngine = new CLIEngine({ extensions: ['.js', '.jsx', '.ts', '.tsx'] });
  protected afterWatch() {
    const { results } = this.cliEngine.executeOnFiles(['.']);
    for (const lintResult of results) {
      for (const { severity, line, column, message } of lintResult.messages) {
        if (severity !== 0) {
          const fullMessage = `(${line},${column}) ${message}`;
          this.error(lintResult.filePath, fullMessage, severity === 2 ? 'error' : 'warning');
        }
      }
    }
  }
}
