import { EnumsSchema, TsContext, ValidationContext } from '@dota-data/scripts/lib/schema';
import _ from 'lodash';
import { Hooks, NpcPluginApi } from '../..';

class CustomEnumsSchema extends EnumsSchema {
  public static from(schema: EnumsSchema) {
    const newSchema = new CustomEnumsSchema(schema._name);
    newSchema._flags = schema._flags;
    return newSchema;
  }

  public toTypeScript(context: TsContext) {
    const members = this.getShortNames()
      .map(name => `${/^\d/.test(name) ? JSON.stringify(name) : name} = ${JSON.stringify(name)},`)
      .join('\n');
    context.addGlobal(`enum ${this._name} {\n${members}\n}`);
    // TODO: Get rid of side effects
    (global as any)[this._name] = _.keyBy(this.getShortNames());
    return this._name + (this._flags ? ` | ${this._name}[]` : '');
  }

  public toSchema(): object {
    const names = this.getShortNames();
    const namesSchema = { enum: names };
    if (!this._flags) return namesSchema;

    return {
      anyOf: [namesSchema, { type: 'array', uniqueItems: true, items: namesSchema }],
    };
  }

  public validate(value: unknown, context: ValidationContext) {
    if (typeof value !== 'string' && !(this._flags && Array.isArray(value))) {
      context.addErrorThere(`should be a string${this._flags ? ' or an array of strings' : ''}`);
      return;
    }

    const names = this.getShortNames();
    if (Array.isArray(value)) {
      _.castArray(value).forEach((v, i) => {
        if (!names.includes(v)) context.of(i).addErrorThere(`should be a ${this._name} enum`);
      });
    } else if (!names.includes(value)) {
      context.addErrorThere(`should be a ${this._name} enum`);
    }
  }

  private getShortNames() {
    return this.getDefinition().members.map(x => x.name);
  }

  public mapValue(value: unknown) {
    const getOriginalName = (name: unknown) => {
      const member = this.getDefinition().members.find(x => x.name === name);
      return member ? member.originalName : name;
    };

    if (typeof value === 'string') return getOriginalName(value);
    if (!this._flags || !Array.isArray(value)) return value;
    return value.map(getOriginalName).join(' | ');
  }
}

export function BetterEnumsPlugin(hooks: Hooks, { collectedSchemas }: NpcPluginApi) {
  hooks.schemas.tap('BetterEnumsPlugin', schemas =>
    Object.values(schemas).forEach(schema =>
      schema
        .getChildrenDeepLike(EnumsSchema)
        .forEach(x => x.replaceWith(CustomEnumsSchema.from(x))),
    ),
  );

  hooks.transform.tap('BetterEnumsPlugin', (files, group) => {
    if (collectedSchemas[group] == null) return;
    _.each(files, file => {
      collectedSchemas[group].validateRoot(file, {
        afterVisit(schema, value, context) {
          if (schema instanceof CustomEnumsSchema) {
            _.set(file, context.path, schema.mapValue(value));
          }
        },
      });
    });
  });
}
