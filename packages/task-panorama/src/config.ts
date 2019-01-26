import CopyWebpackPlugin from 'copy-webpack-plugin';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import path from 'path';
import sass from 'sass';
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';
import webpack from 'webpack';
import WebpackChain from 'webpack-chain';
import { EntryLoaderOptions } from './plugins/entry-loader';
import { HtmlWebpackXmlPlugin } from './plugins/HtmlWebpackXmlPlugin';
import { PanoramaEntriesPlugin } from './plugins/PanoramaEntriesPlugin';

function scripts(w: WebpackChain, context: string) {
  const panorama = path.join(context, 'src', 'panorama');
  const configFile = path.join(panorama, 'tsconfig.json');
  const tslintConfig = path.join(panorama, 'tslint.json');
  const entryLoaderOptions: EntryLoaderOptions = {
    ignoredPlugins: [
      'HtmlWebpackPlugin',
      'HtmlWebpackXmlPlugin',
      'ForkTsCheckerWebpackPlugin',
      'PanoramaEntriesPlugin',
    ],
  };

  w.module
    .rule('typescript')
    .test(/\.tsx?$/)
    .exclude.add(/node_modules/)
    .end()

    .use('entry-loader')
    .loader(require.resolve('./plugins/entry-loader'))
    .options(entryLoaderOptions)
    .end()

    .use('ts-loader')
    .loader('ts-loader')
    .options({ configFile, transpileOnly: true })
    .end()
    .end()

    .rule('javascript')
    .test(/\.jsx?$/)
    .use('entry-loader')
    .loader(require.resolve('./plugins/entry-loader'))
    .options(entryLoaderOptions)
    .end()
    .end()

    .end()
    .resolve.extensions.add('.js')
    .add('.jsx')
    .add('.ts')
    .add('.tsx');

  w.plugin('fork-ts-checker-webpack-plugin').use(ForkTsCheckerWebpackPlugin, [
    {
      configFile,
      async: false,
      silent: true,
      tslint: tslintConfig,
    },
  ]);

  w.resolve
    .plugin('tsconfig-paths-plugin')
    // @ts-ignore
    .use(TsconfigPathsPlugin)
    .end()
    .end();

  const dotaContextBannerOptions: webpack.BannerPlugin.Options = {
    banner: 'var self = this;',
    raw: true,
    test: /\.js$/,
  };
  w.plugin('dota-context').use(webpack.BannerPlugin, [dotaContextBannerOptions]);
}

function layout(w: WebpackChain, context: string) {
  w.module
    .rule('xml')
    .test(/\.xml$/)
    .use('emit-loader')
    .loader(require.resolve('./plugins/emit-loader'))
    .end()
    .use('panorama-layout-loader')
    .loader(require.resolve('./plugins/panorama-layout-loader'))
    .end()
    .end()

    .end()
    .resolve.extensions.add('.xml');

  const manifestPath = path.join(context, 'src', 'panorama', 'manifest.json');
  w.plugin('panorama-entries').use(PanoramaEntriesPlugin, [manifestPath]);

  const opts: HtmlWebpackPlugin.Options = {
    filename: 'custom_ui_manifest.xml',
    inject: false,
    template: path.join(__dirname, '../template.ejs'),
    xhtml: true,
  };
  w.plugin('html-webpack-plugin').use(HtmlWebpackPlugin, [opts]);
  w.plugin('html-webpack-xml-plugin').use(HtmlWebpackXmlPlugin);
}

function styles(w: WebpackChain) {
  w.module
    .rule('css')
    .test(/\.css$/)
    .use('file-loader')
    .loader('file-loader')
    .options({ name: 'styles/[name].css' })
    .end()
    .end()

    .rule('sass')
    .test(/\.s(a|c)ss$/)
    .use('file-loader')
    .loader('file-loader')
    .options({ name: 'styles/[name].css' })
    .end()

    .use('sass-loader')
    .loader('sass-loader')
    .options({ implementation: sass })
    .end()

    .end();
}

function resources(w: WebpackChain) {
  w.module
    .rule('images')
    .test(/\.(png|jpg|gif)$/)
    .use('file-loader')
    .loader('file-loader')
    .options({ limit: 8192, name: 'images/[name].[hash:8].[ext]' })
    .end()
    .end()

    .rule('yaml')
    .test(/\.ya?ml$/)
    .use('yml-loader')
    .loader('yml-loader')
    .end()
    .end()

    .end()

    .resolve.extensions.add('.yml')
    .add('.yaml')
    .end();
}

export function defaultConfig(
  w: WebpackChain,
  { context, dotaPath, addonName }: { context: string; dotaPath?: string; addonName: string },
) {
  scripts(w, context);
  layout(w, context);
  styles(w);
  resources(w);

  const resolveContent = (...sub: string[]) =>
    dotaPath == null ? '/' : path.join(dotaPath, 'content', 'dota_addons', addonName, ...sub);

  const output = resolveContent('panorama', 'layout', 'custom_game');

  w.target('webworker')
    // TODO: Make a runtime consumer for nosources-source-map
    .devtool(false)
    .context(path.join(context, 'src', 'panorama'))

    .output.path(output)
    .publicPath('file://{resources}/layout/custom_game/')
    .filename('[name]')
    .end()

    // TODO: It would be nice to use splitChunks instead of DllPlugin
    // But webpack 4 not supports sharing chunks with child compiler.
    // See:
    // https://github.com/webpack-contrib/worker-loader/issues/70
    // https://github.com/webpack/webpack/pull/6447
    .optimization.splitChunks({ cacheGroups: { vendor: false, default: false } });

  // @ts-ignore
  w.mode(process.env.NODE_ENV === 'production' ? 'production' : 'development');
  // @ts-ignore
  w.output.globalObject('self');

  const copyWebpackPluginArgs: ConstructorParameters<typeof CopyWebpackPlugin> = [
    [{ from: 'images', to: resolveContent('panorama', 'images') }],
  ];
  w.plugin('copy-webpack-plugin').use(CopyWebpackPlugin, copyWebpackPluginArgs);

  const bannerOptionsJs: webpack.BannerPlugin.Options = {
    banner: `This file is generated by Eaglesong.
  name:      [name]
  file:      [file]
  hash:      [hash]
  chunkhash: [chunkhash]`,
    test: /\.js$/,
  };
  w.plugin('banner-js').use(webpack.BannerPlugin, [bannerOptionsJs]);
}
