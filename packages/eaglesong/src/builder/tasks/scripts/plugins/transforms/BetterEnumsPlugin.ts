import * as s from 'dota-data/lib/schema';
import _ from 'lodash';
import { getGroupSchema, Plugin } from '../../plugin';

class CustomEnumsSchema extends s.EnumsSchema {
  public static from(schema: s.EnumsSchema) {
    const newSchema = new CustomEnumsSchema(schema._name);
    newSchema._flags = schema._flags;
    return newSchema;
  }

  public toTypeScript(context: s.TsContext) {
    // TODO: Get rid of side effects
    (global as any)[this._name] = Object.fromEntries(
      this.getDefinition().members.map(({ name, shortName }) => [shortName, name]),
    );

    const memberDeclarations = this.getDefinition()
      .members.map(({ name, shortName }) => {
        const escapedName = /^\d/.test(shortName) ? JSON.stringify(shortName) : shortName;
        return `    ${escapedName} = ${JSON.stringify(name)},`;
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
      for (const [index, element] of value.entries()) {
        if (!validNames.includes(element)) {
          context.of(index).addErrorThere(`should be a ${this._name} enum`);
        }
      }
    } else if (!validNames.includes(value)) {
      context.addErrorThere(`should be a ${this._name} enum`);
    }
  }

  public mapValue(value: unknown) {
    return this._flags && Array.isArray(value) ? value.join(' | ') : value;
  }
}

export const BetterEnumsPlugin: Plugin = ({ hooks, collectedSchemas }) => {
  hooks.schemas.tap('BetterEnumsPlugin', (schemas) => {
    for (const schema of Object.values(schemas)) {
      schema
        .getChildrenDeepLike(s.EnumsSchema)
        .forEach((x) => x.replaceWith(CustomEnumsSchema.from(x)));
    }
  });

  hooks.transform.tap('BetterEnumsPlugin', (files, group) => {
    const schema = getGroupSchema(collectedSchemas, group);
    if (schema == null) return;

    _.each(files, (file) => {
      schema.validateRoot(file, {
        afterVisit(element, value, context) {
          if (element instanceof CustomEnumsSchema) {
            _.set(file, context.path, element.mapValue(value));
          }
        },
      });
    });
  });
};
