import { ImportMessage } from '@posthtml/esm';
import posthtml from 'posthtml';
import { promisify } from 'util';
import vm from 'vm';
import webpack from 'webpack';

const { parser, render } = posthtml().constructor;

async function loadModule(ctx: webpack.loader.LoaderContext, request: string): Promise<string> {
  try {
    return await promisify((ctx as any).loadModule)(request);
  } catch (err) {
    return `module.exports = ${JSON.stringify(err.name)}`;
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
    throw new Error(`${filename} expected to export constant string, but got ${typeof exported}`);
  }

  return exported;
}

const isImportMessage = (msg: posthtml.Message): msg is ImportMessage => msg.type === 'import';

export function loadImports(ctx: webpack.loader.LoaderContext): posthtml.Plugin {
  const compilation: webpack.compilation.Compilation = ctx._compilation;
  const publicPath: string = compilation.outputOptions.publicPath;

  return async (tree: posthtml.Api) => {
    const messages = tree.messages;
    let html = render(tree);

    const loadedModules = await Promise.all(
      messages.filter(isImportMessage).map(async msg => {
        const source = await loadModule(ctx, msg.url);
        const result = evaluateModule(publicPath, msg.url, source);
        return { name: msg.name, result };
      }),
    );

    loadedModules.forEach(mod => (html = html.replace(`\${${mod.name}}`, mod.result)));

    return parser(html);
  };
}
