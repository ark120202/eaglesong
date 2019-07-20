import { Task } from '@eaglesong/helper-task';
import fs from 'fs-extra';
import _ from 'lodash';
import MemoryFS from 'memory-fs';
import path from 'path';
import webpack from 'webpack';
import { Cache, Common, getDirtyCommons, loadCache, makeConfigs, runCompiler } from './cache';
import { createWebpackConfig } from './config';
import { UseCommonsPlugin } from './plugins/UseCommonsPlugin';

interface RealWebpackStats extends webpack.Stats {
  compilation: webpack.compilation.Compilation;
}

type WebpackError = Error | string;
function extractErrorsFromStats(stats: RealWebpackStats, type: 'errors' | 'warnings') {
  let errors: WebpackError[] = [];
  const processCompilation = (c: webpack.compilation.Compilation) => {
    errors = errors.concat(c[type]);
    c.children.forEach(processCompilation);
  };
  processCompilation(stats.compilation);
  return _.unionBy(errors, error => (typeof error === 'string' ? error : error.message));
}

interface ForkTsCheckerError extends Error {
  file: string;
  location: { line: number; character: number };
  message: string;
  rawMessage: string;
}

function isForkTsCheckerError(error: any): error is ForkTsCheckerError {
  return (
    typeof error === 'object' &&
    'file' in error &&
    'location' in error &&
    'message' in error &&
    'rawMessage' in error
  );
}

export interface Options {
  common?: Record<string, Common>;
  commonConfig?(config: webpack.Configuration): webpack.Configuration;
  mainConfig?(config: webpack.Configuration): webpack.Configuration;
}

export default class PanoramaTask extends Task<Options> {
  constructor(options: Options = {}) {
    super(options);
  }

  public apply() {
    this.hooks.build.tapPromise(this.constructor.name, () => this.build());
    this.hooks.compile.tap(this.constructor.name, addResource =>
      addResource('panorama/**/*.{xml,js,css,png,jpg,tga}'),
    );
  }

  private async buildCommons() {
    const cacheFilePath = this.resolvePath(
      'project',
      'node_modules/.cache/eaglesong-task-panorama.json',
    );

    let newCache: Record<string, Cache> = {};

    if (this.options.common) {
      const outputPath =
        this.dotaPath == null
          ? undefined
          : this.resolvePath('content', 'panorama/layout/custom_game');
      // Webpack not allows slash to ba a path separator on Windows
      const webpackContext = path.normalize(this.resolvePath('src/panorama'));

      const configs = makeConfigs(webpackContext, this.isWatching);
      if (this.options.commonConfig) configs.forEach(this.options.commonConfig);

      const cache = await loadCache(cacheFilePath, Object.keys(this.options.common));
      const dirtyNames = await getDirtyCommons(
        this.isWatching,
        this.context,
        this.options.common,
        cache,
      );
      const dirtyCommons = _.pick(this.options.common, dirtyNames);

      newCache = {
        ...(await runCompiler(this.isWatching, this.context, outputPath, dirtyCommons, configs)),
        ..._.omit(cache, dirtyNames),
      };
    }

    if (this.dotaPath != null) await fs.outputJson(cacheFilePath, newCache);
    return _.mapValues(this.options.common, (v, k) => ({ ...v, manifest: newCache[k].manifest }));
  }

  private async build() {
    const commons = await this.buildCommons();

    let webpackConfig = createWebpackConfig(this);
    if (this.options.mainConfig) webpackConfig = this.options.mainConfig(webpackConfig);
    if (!webpackConfig.plugins) webpackConfig.plugins = [];
    webpackConfig.plugins.push(new UseCommonsPlugin(commons));

    const compiler = webpack(webpackConfig);
    if (this.dotaPath == null) {
      // @ts-ignore
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
      if (!isForkTsCheckerError(error)) {
        this.error(null, typeof error === 'string' ? error : error.message, level);
        return;
      }

      const message = error.rawMessage.replace(
        /^ERROR/,
        `(${error.location.line},${error.location.character})`,
      );
      this.error(error.file, message, level);
    }
  }
}
