import { TransformTask } from '@eaglesong/helper-task';
import path from 'path';
// eslint-disable-next-line node/no-unsupported-features/node-builtins
import { Worker } from 'worker_threads';
import { CLIEngine } from 'eslint';

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
      ...this.options,
    };

    this.worker = new Worker(path.join(__dirname, 'worker.js'), { workerData });

    super.apply();
  }

  protected async afterWatch() {
    this.worker.postMessage(undefined);
    const results = await new Promise<CLIEngine.LintResult[]>(resolve =>
      this.worker.on('message', resolve),
    );

    for (const { filePath, messages } of results) {
      for (const { severity, line, column, message } of messages) {
        if (severity !== 0) {
          const fullMessage = `(${line},${column}) ${message}`;
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
