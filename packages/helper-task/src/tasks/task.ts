import { ServiceErrorReporter } from '@eaglesong/helper-service';
import path from 'upath';
import { BuildHelper } from '../helper';

export enum TaskState {
  Working,
  Ok,
  HasErrors,
  HasWarnings,
}

export interface TaskError {
  file?: string;
  message: string;
  level: 'warning' | 'error';
}

export interface Task<T> extends BuildHelper {}
export abstract class Task<T> {
  // Injected
  public _stateCallback!: () => void;
  protected _helper!: BuildHelper;

  /** @internal */
  public setHelper(value: BuildHelper) {
    this._helper = value;

    const props = new Set<string>();
    let proto = value;
    do {
      Object.getOwnPropertyNames(proto).forEach(p => props.add(p));
      proto = Object.getPrototypeOf(proto);
    } while (proto);

    for (const prop of props) {
      if (Object.getPrototypeOf(this)[prop] == null) {
        (this as any)[prop] = (value as any)[prop];
      }
    }
  }

  public name: string;
  public constructor(public readonly options: T) {
    this.name = this.constructor.name;
  }

  public abstract apply(): void | Promise<void>;

  public errors: TaskError[] = [];
  public state: TaskState = TaskState.Working;
  public get errorLevel() {
    return this.errors.reduce<'error' | 'warning' | undefined>(
      (acc, err) => (acc === 'error' ? 'error' : err.level),
      undefined,
    );
  }

  public start() {
    if (this.state === TaskState.Working) {
      throw new Error('task.start() called in incorrect state');
    }

    this.state = TaskState.Working;
    this._stateCallback();
  }

  public finish() {
    if (this.state !== TaskState.Working) {
      throw new Error('task.finish() called in incorrect state');
    }

    switch (this.errorLevel) {
      case 'error':
        this.state = TaskState.HasErrors;
        break;
      case 'warning':
        this.state = TaskState.HasWarnings;
        break;
      default:
        this.state = TaskState.Ok;
    }

    this._stateCallback();
  }

  public error: ServiceErrorReporter = (file, message, level = 'error') => {
    if (file != null && !path.isAbsolute(file)) {
      throw new Error('Task.error got relative file path. Absolute path is expected.');
    }

    if (this.state !== TaskState.Working) {
      throw new Error('Task shown signs of life in incorrect state');
    }

    this.errors.push({
      file: file != null ? file : undefined,
      message,
      level,
    });
  };

  public removeErrors() {
    this.errors = [];
  }

  public async import(id: string) {
    try {
      return await this._helper.import(id);
    } catch (err) {
      this.error(id, err.message);
      return {};
    }
  }
}

export type TaskMapForEachCallback<MT> = <T extends TaskConstructor<any>>(
  value: InstanceType<T>,
  key: T,
  map: MT,
) => void;

export type TaskConstructor<T> = new (options: T) => Task<T>;
export type TaskProvider = <T extends TaskConstructor<any>>(key: T) => InstanceType<T> | undefined;

export interface TaskMap extends Map<any, any> {
  get: TaskProvider;
  forEach(callbackfn: TaskMapForEachCallback<this>): void;
  set<T extends TaskConstructor<any>>(key: T, value: InstanceType<T>): this;
  delete(key: TaskConstructor<any>): boolean;
  has(key: TaskConstructor<any>): boolean;
}

export interface ReadonlyTaskMap extends ReadonlyMap<any, any> {
  get: TaskProvider;
  forEach(callbackfn: TaskMapForEachCallback<this>): void;
  has(key: TaskConstructor<any>): boolean;
}
