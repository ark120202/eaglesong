function getFileScope(): [any, string] {
  let level = 1;
  while (true) {
    const info = debug.getinfo(level, 'S');
    if (info && info.what === 'main') {
      return [getfenv(level), info.source!];
    }

    level += 1;
  }
}

function toDotaClassInstance(table: new () => any) {
  const instance: any = {};
  let prototype = table.prototype;
  while (prototype) {
    for (const key in prototype) {
      if (instance[key] == null) {
        instance[key] = prototype[key];
      }
    }

    prototype = getmetatable(prototype);
  }

  (instance.____constructor as (this: any) => any).call(instance);

  return instance;
}

export const registerAbility = (name: string) => (ability: new () => CDOTA_Ability_Lua) => {
  const [env] = getFileScope();
  env[name] = toDotaClassInstance(ability);
};

export const registerModifier = (name: string) => (modifier: new () => CDOTA_Modifier_Lua) => {
  (modifier as any).name = name;

  const [env, source] = getFileScope();
  const [fileName] = string.gsub(source, '.*scripts[\\/]vscripts[\\/]', '');

  env[name] = toDotaClassInstance(modifier);
  LinkLuaModifier(name, fileName, LuaModifierMotionType.NONE);
};

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface BaseAbility extends CDOTA_Ability_Lua {}
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class BaseAbility {}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface BaseModifier extends CDOTA_Modifier_Lua {}
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class BaseModifier {
  public static apply<T extends typeof BaseModifier>(
    this: T,
    target: CDOTA_BaseNPC,
    caster?: CDOTA_BaseNPC,
    ability?: CDOTABaseAbility,
    modifierTable?: object,
  ): InstanceType<T> {
    return target.AddNewModifier(caster, ability, this.name, modifierTable) as any;
  }
}
