import { EventHandler, MapHandler } from './event-handler';

function traverseNetworkedTable(data: Record<string, any>) {
  for (const key in data) {
    if (typeof data[key] === 'string') {
      if (!isNaN(data[key])) data[key] = Number(data[key]);
    } else if (typeof data[key] === 'object' && data[key].__array) {
      delete data[key].__array;
      data[key] = Object.keys(data[key]).map(k => data[key][k]);
    }
  }
}

export function event<T extends object = any>(name: string) {
  return new EventHandler<T>(emit =>
    GameEvents.Subscribe(name, data => {
      traverseNetworkedTable(data);
      emit(data as any);
    }),
  );
}

export function send<T extends object = any>(name: string, data: T) {
  GameEvents.SendCustomGameEventToServer(name, data);
}

type FlatTable = Record<string, string | number | boolean | null | undefined>;
export function entity<T extends FlatTable>(id: EntityId): T {
  return CustomNetTables.GetTableValue('entities', id.toString());
}

const setImmediate = (Promise.resolve().then.bind(Promise.resolve()) as unknown) as (
  callback: () => void,
) => void;
export function table<T extends object = any>(tableName: string, initial = true) {
  return new MapHandler<T>(emit => {
    CustomNetTables.SubscribeNetTableListener(tableName, (_, key, value) =>
      emit(key as any, value),
    );

    if (!initial) return;
    setImmediate(() => {
      const values = CustomNetTables.GetAllTableValues(tableName);
      values.forEach(({ key, value }) => emit(key as any, value));
    });
  });
}
