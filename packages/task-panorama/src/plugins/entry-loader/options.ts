import * as webpack from 'webpack';
import schema from './options.json';

export { schema };
export interface LoaderOptions {
  filename?: string;
  plugins?: boolean | (string | webpack.Plugin)[];
  ignoredPlugins?: string[];
}
