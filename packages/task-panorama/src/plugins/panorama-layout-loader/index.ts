import { imports, urls } from '@posthtml/esm';
import validate from '@webpack-contrib/schema-utils';
import { getOptions } from 'loader-utils';
import posthtml from 'posthtml';
import webpack from 'webpack';
import { getCommonsForCompiler } from '../UseCommonsPlugin';
import { LoaderOptions, schema } from './options';
import { banTextNodes } from './posthtml-plugin-ban-text-nodes';
import { dependencies } from './posthtml-plugin-dependencies';
import { loadImports } from './posthtml-plugin-load-imports';

// Loader Defaults
const defaults: LoaderOptions = {
  url: true,
  import: true,
};

export interface PostHTMLLoaderMeta {
  ast?: { type: 'posthtml'; root: posthtml.Node[] };
  messages: posthtml.Message[];
}

export default async function(
  this: webpack.loader.LoaderContext,
  source: string,
  _map: never,
  meta?: PostHTMLLoaderMeta,
) {
  const options: LoaderOptions = { ...defaults, ...getOptions(this) };
  validate({ name: 'Panorama Layout Loader', schema, target: options });

  const cb = this.async()!;

  const plugins: posthtml.Plugin[] = [];

  if (options.url !== false) {
    plugins.push(urls(options.url === true ? {} : { url: options.url }));
  }

  if (options.import !== false) {
    plugins.push(
      imports({
        import: options.import === true ? undefined : options.import,
        template: options.template,
      }),
    );
  }

  plugins.push(loadImports(this));

  const { preserved, notPreserved } = getCommonsForCompiler(this._compiler)!;
  const isLoadingScreen = this._module.reasons.some(
    (r: any) => r.dependency.loc.name === 'custom_loading_screen.xml',
  );

  // We're using loading screen as entry point for all not preserved libraries
  // because loading screen is loaded before manifest
  const commons = [...preserved, ...(isLoadingScreen ? notPreserved : [])];
  const publicPath = this._compiler.options.output!.publicPath!;
  const commonDependencies = commons.map(n => `${publicPath}scripts/${n}.js`);
  plugins.push(dependencies(commonDependencies));
  plugins.push(banTextNodes(m => this.emitError(m)));

  try {
    const input = meta && meta.ast && meta.ast.type === 'posthtml' ? meta.ast.root : source;
    const { html } = await posthtml(plugins).process(input, {
      closingSingleTag: 'slash',
      xmlMode: true,
    });

    cb(null, html);
  } catch (err) {
    cb(err);
  }
}
