import assert from 'assert';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import path from 'path';
import { URL } from 'url';
import webpack from 'webpack';

export interface XmlChunk extends webpack.Chunk {
  __type?: string;
}

interface XmlAsset {
  file: string;
  type: string;
}

export class HtmlWebpackXmlPlugin {
  public apply(compiler: webpack.Compiler) {
    compiler.hooks.compilation.tap(this.constructor.name, (compilation) => {
      // @ts-ignore HtmlWebpackPlugin depends on @types/webpack
      const hooks = HtmlWebpackPlugin.getHooks(compilation);

      hooks.beforeAssetTagGeneration.tap(this.constructor.name, (args) => {
        const xmlAssets: XmlAsset[] = [];

        for (const chunk of compilation.chunks as Set<XmlChunk>) {
          for (const file of chunk.files) {
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

      const { publicPath } = compilation.outputOptions;
      assert(typeof publicPath === 'string');

      hooks.beforeEmit.tap(this.constructor.name, (args) => {
        const images = Object.keys(compilation.assets)
          .filter((assetName) => /\.(png|je?pg)$/.test(assetName))
          .map((assetName) => {
            const url = new URL(publicPath as string);
            url.pathname = path.posix.resolve(url.pathname, assetName);
            return url.toString();
          });

        if (images.length > 0) {
          args.html = `<!--\n${images.map((x) => `"${x}"`).join('\n')}\n-->\n${args.html}`;
        }

        return args;
      });
    });
  }
}
