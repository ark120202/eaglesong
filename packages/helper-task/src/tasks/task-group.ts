import _ from 'lodash';
import { Task, TaskConstructor } from './task';

export interface TaskGroup<T> extends Task<T> {
  apply(): Promise<void>;
}

export function createTaskGroup<T>(
  childTasks: TaskConstructor<T>[],
): new (...args: any[]) => TaskGroup<T> {
  return class extends Task<T> {
    private readonly subtasks: Task<T>[];
    private readonly runningTasks = new Set<Task<T>>();
    constructor(options: T) {
      super(options);
      this.subtasks = childTasks.map(ChildTask => new ChildTask(options));
    }

    public get errors() {
      return _.flatten(this.subtasks.map(x => x.errors));
    }

    public set errors(_value) {
      throw new Error("Task group errors can't be updated");
    }

    public removeErrors() {
      this.subtasks.forEach(t => t.removeErrors());
    }

    public async apply() {
      this.subtasks.forEach(t => {
        this.runningTasks.add(t);
        t.setHelper(this._helper);

        Object.defineProperty(t, 'errorLevel', { get: () => this.errorLevel });
        Object.defineProperty(t, 'state', { get: () => this.state });

        t.start = () => {
          this._stateCallback();
          if (this.runningTasks.size === 0) this.start();
          this.runningTasks.add(t);
        };

        t.finish = () => {
          this._stateCallback();
          this.runningTasks.delete(t);
          if (this.runningTasks.size === 0) this.finish();
        };
      });
      await Promise.all(this.subtasks.map(t => t.apply()));
    }
  };
}
