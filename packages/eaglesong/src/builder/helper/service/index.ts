export * from './evaluate';
export * from './plugin';

export type ServiceErrorReporter = (error: ServiceErrorMessage) => void;
export interface ServiceErrorMessage {
  fileName?: string;
  level?: 'warning' | 'error';
  message: string;
}

export type ErrorReporter = (error: ErrorMessage) => void;
export interface ErrorMessage {
  filePath?: string;
  level?: 'warning' | 'error';
  message: string;
}

// A hack to make type alias display full name instead of value
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface NamedType {}
