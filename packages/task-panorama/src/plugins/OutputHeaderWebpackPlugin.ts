import { getOutputHeader, OutputOptions } from '@eaglesong/helper-task';
import webpack from 'webpack';
import { ConcatSource } from 'webpack-sources';
import Template from 'webpack/lib/Template';

export { OutputOptions };

function wrapComment(str: string) {
  if (!str.includes('\n')) {
    return Template.toComment(str);
  }

  return `/*!\n * ${str
    .replace(/\*\//g, '* /')
    .split('\n')
    .join('\n * ')
    .replace(/\s+\n/g, '\n')
    .trimRight()}\n */`;
}

function wrapXmlComment(str: string) {
  return `<!--\n${str}\n-->`;
}

export class OutputHeaderWebpackPlugin {
  constructor(private options: OutputOptions) {}

  public apply(compiler: webpack.Compiler) {
    compiler.hooks.compilation.tap('OutputHeaderWebpackPlugin', (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: 'OutputHeaderWebpackPlugin',
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
        },
        () => {
          for (const chunk of compilation.chunks) {
            for (const file of chunk.files) {
              // html-webpack-plugin passes JavaScript code under .xml extension
              // Note: compilation.compiler !== compiler
              // TODO: Add header to custom_ui_manifest.xml too
              if (compilation.compiler.name?.startsWith('html-webpack-plugin for')) return;

              if (!(file.endsWith('.js') || file.endsWith('.css') || file.endsWith('.xml'))) return;

              const header = getOutputHeader(this.options, file);
              if (header === undefined) continue;

              const prefix = file.endsWith('.xml') ? wrapXmlComment(header) : wrapComment(header);
              // @ts-ignore
              compilation.updateAsset(file, (old) => new ConcatSource(prefix, '\n', old));
            }
          }
        },
      );
    });
  }
}
