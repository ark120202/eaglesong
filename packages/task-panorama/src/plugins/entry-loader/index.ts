import validate from '@webpack-contrib/schema-utils';
import { getOptions, interpolateName } from 'loader-utils';
import path from 'upath';
import webpack from 'webpack';
import SingleEntryPlugin from 'webpack/lib/SingleEntryPlugin';
import schema from './options.schema.json';

export interface EntryLoaderOptions {
  filename?: string;
  plugins?: boolean | (string | webpack.Plugin)[];
  ignoredPlugins?: string[];
}

export function pitch(this: webpack.loader.LoaderContext, request: string) {
  // @ts-ignore
  if (this._compiler.isChild()) return;

  const module: webpack.compilation.Module = this._module;
  // @ts-ignore
  // eslint-disable-next-line prefer-destructuring
  const issuer = module.issuer;
  if (issuer == null) return;
  if (!issuer.resource.endsWith('.xml')) return;

  let target = getOptions(this);
  if (target == null) target = {};
  validate({ name: 'Entry Loader', schema, target });
  const options: EntryLoaderOptions & { filename: string } = {
    filename: 'scripts/[name].js',
    ...target,
  };

  this.addDependency(request);

  const filename = interpolateName(this, options.filename, {});
  const compiler = createCompiler(this, filename, options);
  runCompiler(compiler, this.async()!);
}

function runCompiler(compiler: webpack.Compiler, callback: webpack.loader.loaderCallback) {
  // @ts-ignore
  compiler.runAsChild((error: Error | undefined, chunks: webpack.compilation.Chunk[]) => {
    if (error) {
      callback(error);
    } else if (chunks.length > 0) {
      const url = chunks[0].files[0];
      callback(null, `module.exports = __webpack_public_path__ + ${JSON.stringify(url)};`);
    } else {
      callback(null, '');
    }
  });
}

function createCompiler(
  loader: webpack.loader.LoaderContext,
  filename: string,
  options: EntryLoaderOptions,
) {
  const oldCompilation: webpack.compilation.Compilation = loader._compilation;
  const oldCompiler = loader._compiler;
  const oldOutputOptions = oldCompiler.options.output;
  let plugins: webpack.Plugin[] = [];
  if (options.plugins !== false) {
    if (options.plugins == null || options.plugins === true) {
      const ignoredPlugins = options.ignoredPlugins ?? [];
      plugins = oldCompiler.options.plugins!.filter(
        p => !ignoredPlugins.includes(p.constructor.name),
      );
    } else {
      const allowedPlugins = options.plugins.filter((x): x is string => typeof x === 'string');
      plugins = [
        ...oldCompiler.options.plugins!.filter(p => allowedPlugins.includes(p.constructor.name)),
        ...(options.plugins.filter(x => typeof x !== 'string') as webpack.Plugin[]),
      ];
    }
  }

  // @ts-ignore
  const compilerName = path.relative(oldCompiler.context, loader.resourcePath);
  // @ts-ignore
  const childCompiler: webpack.Compiler = oldCompilation.createChildCompiler(
    compilerName,
    { ...oldOutputOptions, filename },
    plugins,
  );
  // eslint-disable-next-line prefer-destructuring
  const rawRequest: string = loader._module.rawRequest;
  new SingleEntryPlugin(loader.context, rawRequest, 'main').apply(childCompiler);

  childCompiler.hooks.compilation.tap('entry-loader', childCompilation => {
    if (!childCompilation.cache) return;
    if (!childCompilation.cache[compilerName]) childCompilation.cache[compilerName] = {};
    childCompilation.cache = childCompilation.cache[compilerName];
  });

  return childCompiler;
}
