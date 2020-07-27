import { getOptions, interpolateName } from 'loader-utils';
import path from 'upath';
import webpack from 'webpack';
import SingleEntryPlugin from 'webpack/lib/SingleEntryPlugin';

export interface EntryLoaderOptions {
  filename?: string;
  plugins?: (string | webpack.WebpackPluginInstance)[];
}

export function pitch(this: webpack.LoaderContext) {
  this.cacheable(false);
  this.addDependency(this.resourcePath);

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const options: EntryLoaderOptions = getOptions(this) ?? {};
  const filename = interpolateName(this, options.filename ?? '[path][name].js', {
    context: this.rootContext,
  });

  const compiler = createCompiler(this, filename, options.plugins ?? []);

  runCompiler(compiler, this.async()!);
}

function runCompiler(compiler: webpack.Compiler, callback: webpack.LoaderCallback) {
  compiler.runAsChild((error, entries) => {
    if (error) {
      callback(error);
    } else if (entries!.length > 0) {
      const file = [...entries![0].files][0];
      callback(null, `module.exports = __webpack_public_path__ + ${JSON.stringify(file)};`);
    } else {
      callback(null, '');
    }
  });
}

function createCompiler(
  loader: webpack.LoaderContext,
  filename: string,
  pluginsOption: NonNullable<EntryLoaderOptions['plugins']>,
) {
  const { _compilation: oldCompilation, _compiler: oldCompiler } = loader;
  const outputOptions = { ...oldCompilation.outputOptions, filename };

  const allowedPlugins = pluginsOption.filter((x): x is string => typeof x === 'string');
  const plugins = [
    ...oldCompiler.options.plugins!.filter(p => allowedPlugins.includes(p.constructor.name)),
    ...pluginsOption.filter((x): x is webpack.WebpackPluginInstance => typeof x !== 'string'),
  ];

  const compilerName = path.relative(oldCompiler.context, loader.resourcePath);
  // @ts-ignore Type 'WebpackPluginInstance' is not assignable to type 'Plugin'.
  const childCompiler = oldCompilation.createChildCompiler(compilerName, outputOptions, plugins);

  const { rawRequest } = loader._module as webpack.NormalModule;
  new SingleEntryPlugin(loader.context, rawRequest, 'main').apply(childCompiler);

  return childCompiler;
}
