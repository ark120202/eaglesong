import webpack from 'webpack';
import typesWebpack from '@types/webpack';

declare module 'webpack' {
  export interface Loader extends typesWebpack.loader.Loader {}
  export interface LoaderContext extends typesWebpack.loader.LoaderContext {
    _compilation: webpack.Compilation;
    _module: webpack.Module;
  }
  export type LoaderCallback = typesWebpack.loader.loaderCallback;
}
