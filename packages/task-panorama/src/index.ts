import { Task } from '@eaglesong/helper-task';
import { IssueWebpackError } from 'fork-ts-checker-webpack-plugin/lib/issue/IssueWebpackError';
import fs from 'fs-extra';
import _ from 'lodash';
import MemoryFS from 'memory-fs';
import webpack from 'webpack';
import { createWebpackConfig } from './config';
import { manifestSchema } from './plugins/PanoramaManifestPlugin/manifest';

interface RealWebpackStats extends webpack.Stats {
  compilation: webpack.compilation.Compilation;
}

type WebpackError = Error | string;
function extractErrorsFromStats(stats: RealWebpackStats, type: 'errors' | 'warnings') {
  const errors: WebpackError[] = [];

  const processCompilation = (compilation: webpack.compilation.Compilation) => {
    errors.push(...compilation[type]);
    compilation.children.forEach(processCompilation);
  };

  processCompilation(stats.compilation);

  return _.unionBy(errors, error => (typeof error === 'string' ? error : error.message));
}

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

    this.hooks.compile.tap(this.constructor.name, addResource =>
      addResource('panorama/**/*.{xml,js,css}'),
    );
  }

  private async build() {
    let webpackConfig = createWebpackConfig(this);
    if (this.options.config) webpackConfig = this.options.config(webpackConfig);
    if (!webpackConfig.plugins) webpackConfig.plugins = [];

    const compiler = webpack(webpackConfig);
    if (this.dotaPath == null) {
      compiler.outputFileSystem = new MemoryFS();
    }

    if (this.isWatching) {
      compiler.watch({}, (error, stats) => this.compilationHandler(error, stats));
    } else {
      compiler.run((error, stats) => this.compilationHandler(error, stats));
    }

    compiler.hooks.watchRun.tap(this.constructor.name, () => {
      this.removeErrors();
      this.start();
    });

    return new Promise<void>(resolve =>
      compiler.hooks.done.tap(this.constructor.name, () =>
        setImmediate(() => {
          this.finish();
          resolve();
        }),
      ),
    );
  }

  private compilationHandler(webpackError: Error | undefined, stats: webpack.Stats) {
    if (webpackError) throw webpackError;

    if (stats.hasErrors()) {
      this.displayErrors(extractErrorsFromStats(stats as RealWebpackStats, 'errors'), 'error');
    }

    if (stats.hasWarnings()) {
      this.displayErrors(extractErrorsFromStats(stats as RealWebpackStats, 'warnings'), 'warning');
    }
  }

  private displayErrors(errors: WebpackError[], level: 'error' | 'warning') {
    for (const error of errors) {
      if (error instanceof IssueWebpackError) {
        const { line, column } = error.issue.location?.start ?? {};
        const message = `(${line},${column}) ${error.issue.code}: ${error.issue.message}`;
        this.error({ filePath: error.issue.file, level, message });
        continue;
      }

      this.error({ level, message: typeof error === 'string' ? error : error.toString() });
    }
  }
}
