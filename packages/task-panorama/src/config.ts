import { getOutputHeader, OutputOptions } from '@eaglesong/helper-task';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import _ from 'lodash';
import path from 'path';
import sass from 'sass';
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';
import webpack from 'webpack';
import webpackMerge from 'webpack-merge';
import { EntryLoaderOptions } from './plugins/entry-loader';
import { HtmlWebpackXmlPlugin } from './plugins/HtmlWebpackXmlPlugin';
import { PanoramaEntriesPlugin } from './plugins/PanoramaEntriesPlugin';

interface CreateWebpackConfigOptions {
  context: string;
  dotaPath?: string;
  addonName: string;
  outputOptions: OutputOptions;
}

export function createWebpackConfig({
  context,
  dotaPath,
  addonName,
  outputOptions,
}: CreateWebpackConfigOptions) {
  const resolveContent = (...sub: string[]) =>
    dotaPath == null ? '/' : path.join(dotaPath, 'content', 'dota_addons', addonName, ...sub);

  const mainConfig: webpack.Configuration = {
    target: 'webworker',
    // TODO: Make a runtime consumer for nosources-source-map
    devtool: false,
    context: path.join(context, 'src', 'panorama'),
    output: {
      path: resolveContent('panorama', 'layout', 'custom_game'),
      publicPath: 'file://{resources}/layout/custom_game/',
      filename: '[name]',
      globalObject: 'self',
    },
    // TODO: It would be nice to use splitChunks instead of DllPlugin
    // But webpack 4 not supports sharing chunks with child compiler.
    // See:
    // https://github.com/webpack-contrib/worker-loader/issues/70
    // https://github.com/webpack/webpack/pull/6447
    optimization: { splitChunks: { cacheGroups: { vendor: false, default: false } } },
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    plugins: [
      new CopyWebpackPlugin([{ from: 'images', to: resolveContent('panorama', 'images') }]),
    ],
  };

  // TODO: Use custom plugin to pass actual path
  const header = getOutputHeader(outputOptions, 'main.js');
  if (header != null) {
    mainConfig.plugins!.push(
      new webpack.BannerPlugin({
        test: /\.js$/,
        banner: header,
      }),
    );
  }

  const panoramaPath = path.join(context, 'src', 'panorama');
  const configFile = path.join(panoramaPath, 'tsconfig.json');

  const entryLoader: webpack.RuleSetLoader = {
    loader: require.resolve('./plugins/entry-loader'),
    options: _.identity<EntryLoaderOptions>({
      ignoredPlugins: [
        'HtmlWebpackPlugin',
        'HtmlWebpackXmlPlugin',
        'ForkTsCheckerWebpackPlugin',
        'PanoramaEntriesPlugin',
      ],
    }),
  };

  const scriptsConfig: webpack.Configuration = {
    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
      plugins: [new TsconfigPathsPlugin()],
    },
    module: {
      rules: [
        {
          test: /\.jsx?$/,
          use: entryLoader,
        },
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: [entryLoader, { loader: 'ts-loader', options: { configFile, transpileOnly: true } }],
        },
      ],
    },
    plugins: [
      new ForkTsCheckerWebpackPlugin({ tsconfig: configFile, async: false, silent: true }),
      new webpack.BannerPlugin({ banner: 'var self = this;', raw: true, test: /\.js$/ }),
    ],
  };

  const layoutConfig: webpack.Configuration = {
    resolve: { extensions: ['.xml'] },
    module: {
      rules: [
        {
          test: /\.xml$/,
          use: [
            require.resolve('./plugins/emit-loader'),
            require.resolve('./plugins/panorama-layout-loader'),
          ],
        },
      ],
    },
    plugins: [
      new PanoramaEntriesPlugin(path.join(context, 'src', 'panorama', 'manifest.json')),
      new HtmlWebpackPlugin({
        filename: 'custom_ui_manifest.xml',
        inject: false,
        template: path.join(__dirname, '../template.ejs'),
        xhtml: true,
      }),
      new HtmlWebpackXmlPlugin(),
      // TODO: Add banner plugin
    ],
  };

  const stylesConfig: webpack.Configuration = {
    module: {
      rules: [
        {
          test: /\.s(a|c)ss$/,
          use: [
            { loader: 'file-loader', options: { name: 'styles/[name].css' } },
            { loader: 'sass-loader', options: { implementation: sass } },
          ],
        },
        {
          test: /\.css$/,
          loader: 'file-loader',
          options: { name: 'styles/[name].css' },
        },
      ],
    },
    // TODO: Add banner plugin
  };

  const resourcesConfig: webpack.Configuration = {
    module: {
      rules: [
        {
          test: /\.(png|je?pg)$/,
          loader: 'file-loader',
          options: { limit: 8192, name: 'images/[name].[hash:8].[ext]' },
        },
      ],
    },
  };

  return webpackMerge(mainConfig, scriptsConfig, layoutConfig, stylesConfig, resourcesConfig);
}
