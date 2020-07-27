import webpack from 'webpack';

declare class ModuleError extends Error {
  module: webpack.Module;
  error: Error;
  details?: string;
  constructor(module: webpack.Module, err: Error);
}

export = ModuleError;
