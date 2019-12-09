import { ImportMessage } from '@posthtml/esm';
import posthtml from 'posthtml';
import { promisify } from 'util';
import vm from 'vm';
import webpack from 'webpack';

const { parser, render } = posthtml();

async function loadModule(context: webpack.loader.LoaderContext, request: string) {
  try {
    return await promisify(context.loadModule)(request);
  } catch {
    // Actual error is added as a part of child compilation
    return 'module.exports = "error://"';
  }
}

function evaluateModule(publicPath: string, filename: string, source: string) {
  if (source === '') throw new Error("The child compilation didn't provide a result");

  const script = new vm.Script(source, { filename, displayErrors: true });
  const vmContext = {
    __webpack_public_path__: publicPath,
    exports: {},
    module: { exports: {} },
  };
  const sandbox = vm.createContext(vmContext) as typeof vmContext;
  sandbox.module.exports = sandbox.exports;

  script.runInContext(sandbox);

  const exported: any = sandbox.module.exports;

  if (typeof exported !== 'string') {
    throw new TypeError(
      `${filename} expected to export constant string, but got ${typeof exported}`,
    );
  }

  return exported;
}

const isImportMessage = (message: posthtml.Message): message is ImportMessage =>
  message.type === 'import';

export const loadImports = (
  context: webpack.loader.LoaderContext,
): posthtml.Plugin => async tree => {
  const compilation: webpack.compilation.Compilation = context._compilation;
  // TODO: Options shouldn't be required
  const publicPath = compilation.getPath(compilation.outputOptions.publicPath ?? '', {});

  let html = render(tree);

  const loadedModules = await Promise.all(
    tree.messages.filter(isImportMessage).map(async message => {
      const source = await loadModule(context, message.url);
      const result = evaluateModule(publicPath, message.url, source);
      return { name: message.name, result };
    }),
  );

  for (const module of loadedModules) {
    html = html.replace(`\${${module.name}}`, module.result);
  }

  return parser(html);
};
