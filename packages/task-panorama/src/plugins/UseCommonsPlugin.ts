// import { Hooks } from 'html-webpack-plugin';
import _ from 'lodash';
import webpack from 'webpack';
import { Manifest } from '../cache';

const compilerCommons = new WeakMap<
  webpack.Compiler,
  { preserved: string[]; notPreserved: string[] }
>();

export const getCommonsForCompiler = (compiler: webpack.Compiler) => compilerCommons.get(compiler);

export class UseCommonsPlugin implements webpack.Plugin {
  public constructor(
    private commons: Record<string, { manifest: Manifest; preserveRealm: boolean }>,
  ) {}

  public apply(compiler: webpack.Compiler) {
    // @ts-ignore
    const context: string = compiler.context;

    const [preserved, notPreserved] = _.partition(
      Object.entries(this.commons),
      ([, { preserveRealm }]) => preserveRealm,
    ).map(group => group.map(([v]) => v));
    compilerCommons.set(compiler, { preserved, notPreserved });

    _.each(this.commons, ({ manifest }) =>
      // @ts-ignore
      new webpack.DllReferencePlugin({ context, manifest }).apply(compiler),
    );

    // if (notPreserved.length === 0) return;
    // compiler.hooks.compilation.tap(this.constructor.name, compilation => {
    //   const hooks = compilation.hooks as Hooks;
    //   hooks.htmlWebpackPluginBeforeHtmlGeneration.tap(this.constructor.name, args => {
    //     args.assets.js = [
    //       ...args.assets.js,
    //       ...notPreserved.map(n => ({
    //         entryName: n,
    //         path: `${args.assets.publicPath}scripts/${n}.js`,
    //       })),
    //     ];
    //     return args;
    //   });
    // });
  }
}
