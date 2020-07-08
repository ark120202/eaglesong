import { imports, urls } from '@posthtml/esm';
import posthtml from 'posthtml';
import webpack from 'webpack';
import { banTextNodes } from './posthtml-plugin-ban-text-nodes';
import { loadImports } from './posthtml-plugin-load-imports';
import {
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

  const plugins: posthtml.Plugin[] = [
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
