import { imports, urls } from '@posthtml/esm';
import posthtml from 'posthtml';
import webpack from 'webpack';
import { getCommonsForCompiler } from '../UseCommonsPlugin';
import { banTextNodes } from './posthtml-plugin-ban-text-nodes';
import { loadImports } from './posthtml-plugin-load-imports';
import {
  addCommonIncludes,
  preserveIncludesAfter,
  preserveIncludesBefore,
  validateIncludes,
} from './posthtml-plugin-panorama-includes';

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
  const publicPath = this._compiler.options.output!.publicPath!;
  const commons = [...preserved, ...(isLoadingScreen ? notPreserved : [])].map(
    name => `${publicPath}scripts/${name}.js`,
  );

  const plugins: posthtml.Plugin[] = [
    addCommonIncludes(commons),

    preserveIncludesBefore,
    urls(),
    imports(),
    preserveIncludesAfter,

    loadImports(this),
    validateIncludes(this),

    banTextNodes(this),
  ];

  try {
    const input = meta?.ast?.type === 'posthtml' ? meta.ast.root : source;
    const { html } = await posthtml(plugins).process(input, {
      closingSingleTag: 'slash',
      xmlMode: true,
    });

    callback(null, html);
  } catch (error) {
    callback(error);
  }
}
