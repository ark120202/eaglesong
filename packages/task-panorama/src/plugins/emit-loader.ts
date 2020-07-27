import webpack from 'webpack';
import { RawSource } from 'webpack-sources';

export default function emitLoader(this: webpack.LoaderContext, content: string) {
  this.cacheable(false);

  this._compilation.hooks.processAssets.tap(
    { name: 'emit-loader', stage: webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE },
    () => {
      for (const chunk of this._compilation.chunkGraph.getModuleChunks(this._module)) {
        for (const file of chunk.files) {
          // @ts-ignore
          this._compilation.updateAsset(file, new RawSource(content));
        }
      }
    },
  );

  return '';
}
