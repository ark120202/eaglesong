import webpack from 'webpack';

declare class ModuleError extends Error {
  module: webpack.compilation.Module;
  error: Error;
  details?: string;
  constructor(module: webpack.compilation.Module, err: Error);
}

export = ModuleError;
