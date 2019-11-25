export * from './plugin';
export * from './evaluate';

export type ServiceConstructor = new (...args: any[]) => object;
export type ServiceProvider = <T extends ServiceConstructor>(key: T) => InstanceType<T> | undefined;
export type ServiceMapForEachCallback<TMap> = <T extends ServiceConstructor>(
  value: InstanceType<T>,
  key: T,
  map: TMap,
) => void;

export interface ServiceMap extends Map<any, any> {
  get: ServiceProvider;
  forEach(callbackfn: ServiceMapForEachCallback<this>): void;
  set<T extends ServiceConstructor>(key: T, value: InstanceType<T>): this;
  delete(key: ServiceConstructor): boolean;
  has(key: ServiceConstructor): boolean;
}

export interface ReadonlyServiceMap extends ReadonlyMap<any, any> {
  get: ServiceProvider;
  forEach(callbackfn: ServiceMapForEachCallback<this>): void;
  has(key: ServiceConstructor): boolean;
}

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
