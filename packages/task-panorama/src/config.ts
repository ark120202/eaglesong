import { getOutputHeader, OutputOptions } from '@eaglesong/helper-task';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import _ from 'lodash';
import createDotaTransformer from 'panorama-types/transformer';
import path from 'path';
import sass from 'sass';
import { Options as TsLoaderOptions } from 'ts-loader';
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin';
import webpack from 'webpack';
import webpackMerge from 'webpack-merge';
import { EntryLoaderOptions } from './plugins/entry-loader';
import { HtmlWebpackXmlPlugin } from './plugins/HtmlWebpackXmlPlugin';
import { PanoramaManifestPlugin } from './plugins/PanoramaManifestPlugin';

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
      globalObject: 'globalThis',
    },
    // TODO: It would be nice to use splitChunks instead of DllPlugin
    // But webpack 4 not supports sharing chunks with child compiler.
    // See:
    // https://github.com/webpack-contrib/worker-loader/issues/70
    // https://github.com/webpack/webpack/pull/6447
    optimization: { splitChunks: { cacheGroups: { vendor: false, default: false } } },
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    plugins: [],
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

  const resourcesConfig: webpack.Configuration = {
    module: {
      rules: [
        {
          test: /\.(png|je?pg)$/,
          loader: require.resolve('file-loader'),
          options: { name: '[path][name].[ext]', esModule: false },
        },
      ],
    },
    plugins: [
      // Should be applied before `HtmlWebpackPlugin`, since both tap to `emit` hook
      new CopyWebpackPlugin([{ from: 'images', to: resolveContent('panorama', 'images') }]),
    ],
  };

  const panoramaPath = path.join(context, 'src', 'panorama');
  const configFile = path.join(panoramaPath, 'tsconfig.json');

  const scriptsConfig: webpack.Configuration = {
    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
      plugins: [new TsconfigPathsPlugin({ configFile })],
    },
    module: {
      rules: [
        {
          test: /\.[jt]sx?$/,
          issuer: /\.xml$/,
          loader: require.resolve('./plugins/entry-loader'),
          options: _.identity<EntryLoaderOptions>({ plugins: ['BannerPlugin'] }),
        },
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          loader: require.resolve('ts-loader'),
          options: _.identity<Partial<TsLoaderOptions>>({
            configFile,
            transpileOnly: true,
            getCustomTransformers: () => ({ before: [createDotaTransformer()] }),
          }),
        },
      ],
    },
    plugins: [
      new ForkTsCheckerWebpackPlugin({ tsconfig: configFile, async: false, silent: true }),
      new webpack.BannerPlugin({ banner: 'var globalThis = this;', raw: true, test: /\.js$/ }),
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
      new PanoramaManifestPlugin(path.join(context, 'src', 'panorama', 'manifest.yml')),
      new HtmlWebpackPlugin({
        filename: 'custom_ui_manifest.xml',
        inject: false,
        template: path.resolve(__dirname, '../template.ejs'),
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
          test: /\.(c|sa|sc)ss$/,
          issuer: /\.xml$/,
          loader: require.resolve('file-loader'),
          options: { name: '[path][name].css', esModule: false },
        },
        {
          test: /\.s(a|c)ss$/,
          loader: require.resolve('sass-loader'),
          options: { implementation: sass },
        },
      ],
    },
    // TODO: Add banner plugin
  };

  return webpackMerge(mainConfig, resourcesConfig, scriptsConfig, layoutConfig, stylesConfig);
}
