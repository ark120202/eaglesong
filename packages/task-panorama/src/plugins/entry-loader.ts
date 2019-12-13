import { getOptions, interpolateName } from 'loader-utils';
import path from 'upath';
import webpack from 'webpack';
import SingleEntryPlugin from 'webpack/lib/SingleEntryPlugin';

export interface EntryLoaderOptions {
  filename?: string;
  plugins?: (string | webpack.Plugin)[];
}

export function pitch(this: webpack.loader.LoaderContext, request: string) {
  this.addDependency(request);

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const target: EntryLoaderOptions = getOptions(this) ?? {};

  const compiler = createCompiler(
    this,
    interpolateName(this, target.filename ?? '[path][name].js', { context: this.rootContext }),
    target.plugins ?? [],
  );

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
  pluginsOption: NonNullable<EntryLoaderOptions['plugins']>,
) {
  const oldCompilation: webpack.compilation.Compilation = loader._compilation;
  const oldCompiler = loader._compiler;
  const oldOutputOptions = oldCompiler.options.output;

  const allowedPlugins = pluginsOption.filter((x): x is string => typeof x === 'string');
  const plugins = [
    ...oldCompiler.options.plugins!.filter(p => allowedPlugins.includes(p.constructor.name)),
    ...pluginsOption.filter((x): x is webpack.Plugin => typeof x !== 'string'),
  ];

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
