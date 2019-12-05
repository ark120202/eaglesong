import * as s from 'dota-data/lib/schema';
import _ from 'lodash';
import { Plugin } from '../../service';

class CustomEnumsSchema extends s.EnumsSchema {
  public static from(schema: s.EnumsSchema) {
    const newSchema = new CustomEnumsSchema(schema._name);
    newSchema._flags = schema._flags;
    return newSchema;
  }

  public toTypeScript(context: s.TsContext) {
    // TODO: Get rid of side effects
    (global as any)[this._name] = Object.fromEntries(
      this.getDefinition().members.map(({ name, originalName }) => [name, originalName]),
    );

    const memberDeclarations = this.getDefinition()
      .members.map(({ name, originalName }) => {
        const escapedName = /^\d/.test(name) ? JSON.stringify(name) : name;
        return `    ${escapedName} = ${JSON.stringify(originalName)},`;
      })
      .join('\n');

    context.addGlobal(`declare enum ${this._name} {\n${memberDeclarations}\n}`);
    return this._name + (this._flags ? ` | ${this._name}[]` : '');
  }

  public toSchema(): object {
    const names = this.getNames();
    const namesSchema = { enum: names };
    if (!this._flags) return namesSchema;

    return {
      anyOf: [namesSchema, { type: 'array', uniqueItems: true, items: namesSchema }],
    };
  }

  public validate(value: unknown, context: s.ValidationContext) {
    if (typeof value !== 'string' && !(this._flags && Array.isArray(value))) {
      context.addErrorThere(`should be a string${this._flags ? ' or an array of strings' : ''}`);
      return;
    }

    const validNames = this.getNames();
    if (Array.isArray(value)) {
      for (const [index, element] of value) {
        if (!validNames.includes(element)) {
          context.of(index).addErrorThere(`should be a ${this._name} enum`);
        }
      }
    } else if (!validNames.includes(value)) {
      context.addErrorThere(`should be a ${this._name} enum`);
    }
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

export const BetterEnumsPlugin: Plugin = ({ hooks, collectedSchemas }) => {
  hooks.schemas.tap('BetterEnumsPlugin', schemas =>
    Object.values(schemas).forEach(schema =>
      schema
        .getChildrenDeepLike(s.EnumsSchema)
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
};
