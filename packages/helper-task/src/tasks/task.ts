import assert from 'assert';
import path from 'upath';
import { BuildHelper } from '../helper';
import { ErrorReporter } from '../service';

export enum TaskState {
  Working,
  Ok,
  HasErrors,
  HasWarnings,
}

export interface TaskError {
  filePath?: string;
  message: string;
  level: 'warning' | 'error';
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Task<T> extends BuildHelper {}
export abstract class Task<T> {
  // Injected
  public _stateCallback!: () => void;
  protected _helper!: BuildHelper;

  /** @internal */
  public setHelper(value: BuildHelper) {
    this._helper = value;

    const props = new Set<string>();
    let proto: any = value;
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

  public name = this.constructor.name;
  constructor(public readonly options: T) {}

  public abstract apply(): void | Promise<void>;

  public errors: TaskError[] = [];
  public state: TaskState = TaskState.Working;
  public get errorLevel() {
    return this.errors.reduce<'error' | 'warning' | undefined>(
      (highestLevel, error) => (highestLevel === 'error' ? 'error' : error.level),
      undefined,
    );
  }

  public start() {
    assert(this.state !== TaskState.Working, 'incorrect task state');

    this.state = TaskState.Working;
    this._stateCallback();
  }

  public finish() {
    assert(this.state === TaskState.Working, 'incorrect task state');

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

  public error: ErrorReporter = ({ filePath, level = 'error', message }) => {
    assert(filePath == null || path.isAbsolute(filePath), 'file path should be absolute');
    assert(this.state === TaskState.Working, 'incorrect task state');

    this.errors.push({ filePath, level, message });
  };

  public removeErrors() {
    this.errors = [];
  }

  public async import(filePath: string) {
    try {
      return await this._helper.import(filePath);
    } catch (error) {
      this.error({ filePath, message: error.message });
      return {};
    }
  }
}

export type TaskConstructor<T> = new (options: T) => Task<T>;
export type TaskProvider = <T extends TaskConstructor<any>>(key: T) => InstanceType<T> | undefined;

export interface ReadonlyTaskMap extends ReadonlyMap<TaskConstructor<any>, Task<any>> {
  get: TaskProvider;
  forEach(
    callbackfn: <T extends TaskConstructor<any>>(value: InstanceType<T>, key: T, map: this) => void,
  ): void;
}

export interface TaskMap extends ReadonlyTaskMap {
  clear(): void;
  set<T extends TaskConstructor<any>>(key: T, value: InstanceType<T>): this;
  delete(key: TaskConstructor<any>): boolean;
}
