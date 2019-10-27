import { imports, urls } from '@posthtml/esm';
import posthtml from 'posthtml';
import webpack from 'webpack';
import { getCommonsForCompiler } from '../UseCommonsPlugin';
import { banTextNodes } from './posthtml-plugin-ban-text-nodes';
import { dependencies } from './posthtml-plugin-dependencies';
import { loadImports } from './posthtml-plugin-load-imports';

export interface PostHTMLLoaderMeta {
  ast?: { type: 'posthtml'; root: posthtml.Node[] };
  messages: posthtml.Message[];
}

export default async function panoramaLayoutLoader(
  this: webpack.loader.LoaderContext,
  source: string,
  _map: never,
  meta?: PostHTMLLoaderMeta,
) {
  const callback = this.async()!;

  const { preserved, notPreserved } = getCommonsForCompiler(this._compiler)!;
  const isLoadingScreen = this._module.reasons.some(
    (r: any) => r.dependency.loc.name === 'custom_loading_screen.xml',
  );

  // We're using loading screen as entry point for all not preserved libraries
  // because loading screen is loaded before manifest
  const commons = [...preserved, ...(isLoadingScreen ? notPreserved : [])];
  const publicPath = this._compiler.options.output!.publicPath!;
  const commonDependencies = commons.map(n => `${publicPath}scripts/${n}.js`);

  const plugins: posthtml.Plugin[] = [
    urls(),
    imports(),
    loadImports(this),
    dependencies(this, commonDependencies),
    banTextNodes(this),
  ];

  try {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const input = meta && meta.ast && meta.ast.type === 'posthtml' ? meta.ast.root : source;
    const { html } = await posthtml(plugins).process(input, {
      closingSingleTag: 'slash',
      xmlMode: true,
    });

    callback(null, html);
  } catch (error) {
    callback(error);
  }
}
