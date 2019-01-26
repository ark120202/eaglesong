import schema from './options.json';

export { schema };
export interface LoaderOptions {
  url?: boolean | string | RegExp | ((url: string) => boolean);
  import?: boolean | string | RegExp | ((url: string) => boolean);
  template?: string;
}
