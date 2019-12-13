import { Hooks } from 'html-webpack-plugin';
import path from 'path';
import { URL } from 'url';
import webpack from 'webpack';

export interface XmlChunk extends webpack.compilation.Chunk {
  __type?: string;
}

interface XmlAsset {
  file: string;
  type: string;
}

export class HtmlWebpackXmlPlugin implements webpack.Plugin {
  public apply(compiler: webpack.Compiler) {
    compiler.hooks.compilation.tap(this.constructor.name, compilation => {
      const hooks = compilation.hooks as Hooks;

      hooks.htmlWebpackPluginBeforeHtmlGeneration.tap(this.constructor.name, args => {
        const xmlAssets: XmlAsset[] = [];

        // eslint-disable-next-line prefer-destructuring
        const chunks: XmlChunk[] = compilation.chunks;
        for (const chunk of chunks) {
          for (const file of chunk.files as string[]) {
            if (!file.endsWith('.xml') || chunk.__type == null) continue;

            xmlAssets.push({
              file: args.assets.publicPath + file,
              type: chunk.__type,
            });
          }
        }

        (args.assets as any).xml = xmlAssets;

        return args;
      });

      hooks.htmlWebpackPluginAfterHtmlProcessing.tap(this.constructor.name, args => {
        const { publicPath } = args.assets;
        const images = Object.keys(compilation.assets)
          .filter(assetName => /\.(png|je?pg)$/.test(assetName))
          .map(assetName => {
            const url = new URL(publicPath);
            // TODO: Move publicPath higher?
            url.pathname = path.posix.resolve(url.pathname, assetName);
            return url.toString();
          });

        if (images.length > 0) {
          args.html = `<!--\n${images.map(x => `"${x}"`).join('\n')}\n-->\n${args.html}`;
        }

        return args;
      });
    });
  }
}
