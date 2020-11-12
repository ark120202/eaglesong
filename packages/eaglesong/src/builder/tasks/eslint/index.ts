import { CLIEngine } from 'eslint';
import path from 'path';
import { Worker } from 'worker_threads';
import { TransformTask } from '../../helper';

// TODO: It's not supposed to be a class
export type Options = InstanceType<typeof CLIEngine.Options>;
export default class ESLintTask extends TransformTask<Options> {
  private readonly extensions = this.options.extensions ?? ['.js', '.jsx', '.ts', '.tsx'];
  protected pattern = [`**/*{${this.extensions.join(',')}}`, '!node_modules'];

  constructor(options: Options = {}) {
    super(options);
  }

  private worker!: Worker;
  public apply() {
    const workerData: CLIEngine.Options = {
      extensions: this.extensions,
      cwd: this.context,
      cache: true,
      cacheLocation: this.resolvePath('node_modules/.cache/eaglesong/.eslintcache'),
      ...this.options,
    };

    this.worker = new Worker(path.join(__dirname, 'worker.js'), { workerData });

    super.apply();
  }

  protected async afterWatch() {
    this.worker.postMessage(undefined);
    const results = await new Promise<CLIEngine.LintResult[]>((resolve) =>
      this.worker.on('message', resolve),
    );

    for (const { filePath, messages } of results) {
      for (const { severity, line, column, message, ruleId } of messages) {
        if (severity !== 0) {
          const ruleName = ruleId != null ? `  ${ruleId}` : '';
          const fullMessage = `(${line},${column}) ${message}${ruleName}`;
          const level = severity === 2 ? 'error' : 'warning';

          this.error({ filePath, level, message: fullMessage });
        }
      }
    }

    if (!this.isWatching) {
      await this.worker.terminate();
    }
  }
}
