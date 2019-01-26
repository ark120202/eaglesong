export type EventHandlerCallback<T> = (data: T) => void;
export class EventHandler<T extends object> {
  private listeners: EventHandlerCallback<T>[] = [];

  public constructor(subscriber: (emit: (data: T) => void) => void) {
    subscriber(x => this.emit(x));
  }

  public on(callback: EventHandlerCallback<T>) {
    this.listeners.push(callback);
  }

  public once(callback: EventHandlerCallback<T>) {
    const handler = (data: T) => {
      this.off(handler);
      callback(data);
    };
    this.on(handler);
  }

  public off(callback: EventHandlerCallback<T>) {
    const li = this.listeners.indexOf(callback);
    if (li === -1) return;
    this.listeners = this.listeners.splice(li, 1);
  }

  public async wait() {
    return new Promise<T>(resolve => this.on(data => resolve(data)));
  }

  private emit(data: T) {
    this.listeners.slice().forEach(c => c(data));
  }
}

export type MapHandlerCallback<T> = <K extends keyof T>(key: K, value: T[K]) => void;
export class MapHandler<T extends object> {
  private listeners: MapHandlerCallback<T>[] = [];

  public constructor(subscriber: (emit: MapHandler<T>['emit']) => void) {
    subscriber(this.emit.bind(this));
  }

  public on(callback: MapHandlerCallback<T>) {
    this.listeners.push(callback);
  }

  public once(callback: MapHandlerCallback<T>) {
    const handler = <K extends keyof T>(key: K, value: T[K]) => {
      this.off(handler);
      callback(key, value);
    };
    this.on(handler);
  }

  public off(callback: MapHandlerCallback<T>) {
    const li = this.listeners.indexOf(callback);
    if (li === -1) return;
    this.listeners = this.listeners.splice(li, 1);
  }

  private emit(key: keyof T, value: T[keyof T]) {
    this.listeners.slice().forEach(c => c(key, value));
  }
}
