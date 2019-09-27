declare class WebpackError extends Error {
  details?: any;
  missing?: any;
  origin?: any;
  dependencies?: any;
  module?: any;
  constructor(message?: string);
}

export = WebpackError;
