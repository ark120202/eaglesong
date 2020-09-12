import { getOutputHeader, OutputOptions } from '@eaglesong/helper-task';
import webpack from 'webpack';

export { OutputOptions };

function wrapComment(comment: string) {
  if (!comment.includes('\n')) {
    return webpack.Template.toComment(comment);
  }

  return `/*!\n * ${comment
    .replace(/\*\//g, '* /')
    .split('\n')
    .join('\n * ')
    .replace(/\s+\n/g, '\n')
    .trimEnd()}\n */`;
}

const wrapXmlComment = (comment: string) => `<!--\n${comment}\n-->`;

export class OutputHeaderWebpackPlugin {
  constructor(private readonly options: OutputOptions) {}

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
              // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
              if (compilation.compiler.name?.startsWith('html-webpack-plugin for')) return;

              if (!(file.endsWith('.js') || file.endsWith('.css') || file.endsWith('.xml'))) return;

              const header = getOutputHeader(this.options, file);
              if (header === undefined) continue;

              const prefix = file.endsWith('.xml') ? wrapXmlComment(header) : wrapComment(header);
              compilation.updateAsset(
                file,
                (old) => new webpack.sources.ConcatSource(prefix, '\n', old),
              );
            }
          }
        },
      );
    });
  }
}
