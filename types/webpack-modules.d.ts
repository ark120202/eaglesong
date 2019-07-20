declare module 'webpack/lib/ModuleError' {
  import webpack from 'webpack';

  class ModuleError extends Error {
    module: webpack.compilation.Module;
    error: Error;
    details?: string;
    constructor(module: webpack.compilation.Module, err: Error);
  }

  export = ModuleError;
}

declare module 'webpack/lib/WebpackError' {
  class WebpackError extends Error {
    details?: any;
    missing?: any;
    origin?: any;
    dependencies?: any;
    module?: any;
    constructor(message?: string);
  }

  export = WebpackError;
}

declare module 'webpack/lib/dependencies/ModuleDependency';
declare module 'webpack/lib/util/identifier';
