import webpack from 'webpack';

export default function emitLoader(this: webpack.loader.LoaderContext, content: string) {
  this.cacheable(false);

  const compilation: webpack.compilation.Compilation = this._compilation;
  const module: webpack.Module = this._module;

  compilation.hooks.optimizeChunkAssets.tap('emit-loader', chunks => {
    chunks.forEach(chunk => {
      if (!chunk.canBeInitial() || !chunk.containsModule(module)) return;
      chunk.files.forEach(file => {
        const manifest = content;
        compilation.assets[file] = {
          size: () => Buffer.byteLength(manifest, 'utf8'),
          source: () => manifest,
        };
      });
    });
  });

  return '';
}
