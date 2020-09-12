import { Task } from '@eaglesong/helper-task';
import { IssueWebpackError } from 'fork-ts-checker-webpack-plugin/lib/issue/IssueWebpackError';
import fs from 'fs-extra';
import MemoryFileSystem from 'memory-fs';
import webpack from 'webpack';
import { manifestSchema } from 'webpack-panorama';
import { createWebpackConfig } from './config';

export interface Options {
  config?(w: webpack.Configuration): webpack.Configuration;
}

export default class PanoramaTask extends Task<Options> {
  constructor(options: Options = {}) {
    super(options);
  }

  public apply() {
    this.hooks.build.tapPromise(this.constructor.name, () => this.build());

    this.hooks.preBuild.tapPromise(this.constructor.name, async () => {
      const schemaPath = this.resolvePath('.eaglesong/schemas/panorama-manifest.json');
      await fs.outputJson(schemaPath, manifestSchema, { spaces: 2 });
    });

    this.hooks.compile.tap(this.constructor.name, (addResource) =>
      addResource('panorama/**/*.{xml,js,css}'),
    );
  }

  private async build() {
    let config = createWebpackConfig(this);
    if (this.options.config) config = this.options.config(config);

    const compiler = webpack(config);
    if (this.dotaPath == null) {
      // @ts-ignore Incompatible types
      compiler.outputFileSystem = new MemoryFileSystem();
    }

    if (this.isWatching) {
      compiler.watch(config.watchOptions ?? {}, (error, stats) => {
        if (error) {
          // TODO:
          console.error(error);
          process.exit(1);
        }

        this.compilationHandler(stats!);
      });

      // Should be after compiler.watch, because it's emitted on first compilation
      compiler.hooks.watchRun.tap(this.constructor.name, () => {
        this.removeErrors();
        this.start();
      });
    } else {
      return new Promise<void>((resolve, reject) => {
        compiler.run((error, stats) => {
          compiler.close((error2) => {
            if (error2 || error) {
              reject(error2 || error);
            } else {
              this.compilationHandler(stats!);
              resolve();
            }
          });
        });
      });
    }
  }

  private compilationHandler(stats: webpack.Stats) {
    this.displayErrors(stats.compilation.errors, 'error');
    this.displayErrors(stats.compilation.warnings, 'warning');
    this.finish();
  }

  // TODO: Use WebpackError type once webpack would export it
  private displayErrors(errors: Error[], level: 'error' | 'warning') {
    for (const error of errors) {
      if (error instanceof IssueWebpackError) {
        const { line, column } = error.issue.location?.start ?? {};
        const message = `(${line},${column}) ${error.issue.code}: ${error.issue.message}`;
        this.error({ filePath: error.issue.file, level, message });
        continue;
      }

      this.error({ level, message: error.toString() });
    }
  }
}
