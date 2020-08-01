import * as s from 'dota-data/lib/schema';
import _ from 'lodash';
import { getGroupSchema, Plugin } from '../../plugin';

const isBinaryBoolean = (schema: s.Schema): schema is s.OneOfSchema =>
  schema instanceof s.OneOfSchema &&
  schema
    .getChildren()
    .every((x) => x instanceof s.LiteralSchema && (x._value === 0 || x._value === 1));

export const BetterBooleansPlugin: Plugin = ({ hooks, collectedSchemas }) => {
  hooks.schemas.tap('BetterBooleansPlugin', (schemas) => {
    for (const schema of Object.values(schemas)) {
      schema
        .getChildrenDeep()
        .filter(isBinaryBoolean)
        .forEach((x) => x.replaceWith(s.bool()));
    }
  });

  hooks.transform.tap('BetterBooleansPlugin', (files, group) => {
    const schema = getGroupSchema(collectedSchemas, group);
    if (schema == null) return;

    _.each(files, (file) => {
      schema.validateRoot(file, {
        afterVisit(element, value, context) {
          if (isBinaryBoolean(element)) {
            _.set(file, context.path, value ? 1 : 0);
          }
        },
      });
    });
  });
};
