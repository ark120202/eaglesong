import CopyWebpackPlugin from 'copy-webpack-plugin';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import _ from 'lodash';
import createDotaTransformer from 'panorama-types/transformer';
import path from 'path';
import sass from 'sass';
import { Options as TsLoaderOptions } from 'ts-loader';
import webpack from 'webpack';
import { merge } from 'webpack-merge';
import {
  PanoramaManifestPlugin,
  PanoramaTargetPlugin,
  PrecachePanoramaAssetsPlugin,
} from 'webpack-panorama';
import PanoramaTask from '.';
import { OutputHeaderWebpackPlugin } from './OutputHeaderWebpackPlugin';

export function createWebpackConfig({ context, dotaPath, addonName, outputOptions }: PanoramaTask) {
  const panoramaPath = path.join(context, 'src', 'panorama');
  const tsconfigPath = path.join(panoramaPath, 'tsconfig.json');

  const contentBasePath =
    dotaPath == null ? '/' : path.join(dotaPath, 'content', 'dota_addons', addonName);
  const resolveContent = (query: string) => path.join(contentBasePath, query);

  const mainConfig: webpack.Configuration = {
    context: panoramaPath,
    output: {
      path: resolveContent('panorama/layout/custom_game'),
      publicPath: 'file://{resources}/layout/custom_game/',
    },
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    plugins: [new PanoramaTargetPlugin(), new OutputHeaderWebpackPlugin(outputOptions)],
  };

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
      // Should be applied before `PanoramaManifestPlugin`, because both tap to the emit hook
      new CopyWebpackPlugin({
        patterns: [{ from: 'images', to: resolveContent('panorama/images') }],
      }),
    ],
  };

  const scriptsConfig: webpack.Configuration = {
    resolve: { extensions: ['.js', '.jsx', '.ts', '.tsx'] },
    module: {
      rules: [
        {
          test: /\.[jt]sx?$/,
          issuer: /\.xml$/,
          loader: require.resolve('webpack-panorama/lib/entry-loader'),
        },
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          loader: require.resolve('ts-loader'),
          options: _.identity<Partial<TsLoaderOptions>>({
            configFile: tsconfigPath,
            transpileOnly: true,
            getCustomTransformers: () => ({ before: [createDotaTransformer()] }),
          }),
        },
      ],
    },
    plugins: [
      new ForkTsCheckerWebpackPlugin({
        async: false,
        logger: { issues: 'silent' },
        typescript: { configFile: tsconfigPath },
      }),
    ],
  };

  const layoutConfig: webpack.Configuration = {
    module: {
      rules: [{ test: /\.xml$/, loader: require.resolve('webpack-panorama/lib/layout-loader') }],
    },
    plugins: [
      new PanoramaManifestPlugin({ entries: path.join(context, 'src/panorama/manifest.yml') }),
      new PrecachePanoramaAssetsPlugin(),
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
          options: {
            implementation: sass,
            sassOptions: {
              // VCSS doesn't allow omitting last semicolon in a rule
              outputStyle: 'expanded',
            },
          },
        },
      ],
    },
  };

  return merge(mainConfig, resourcesConfig, scriptsConfig, layoutConfig, stylesConfig);
}
