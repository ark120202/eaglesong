import * as s from 'dota-data/lib/schema';
import _ from 'lodash';
import { Plugin } from '../../service';

const isBinaryBoolean = (schema: s.Schema): schema is s.OneOfSchema =>
  schema instanceof s.OneOfSchema &&
  schema
    .getChildren()
    .every(x => x instanceof s.LiteralSchema && (x._value === 0 || x._value === 1));

export const BetterBooleansPlugin: Plugin = ({ hooks, collectedSchemas }) => {
  hooks.schemas.tap('BetterBooleansPlugin', schemas =>
    Object.values(schemas).forEach(schema =>
      schema
        .getChildrenDeep()
        .filter(isBinaryBoolean)
        .forEach(x => x.replaceWith(s.bool())),
    ),
  );

  hooks.transform.tap('BetterBooleansPlugin', (files, group) => {
    if (collectedSchemas[group] == null) return;
    _.each(files, file => {
      collectedSchemas[group].validateRoot(file, {
        afterVisit(schema, value, context) {
          if (isBinaryBoolean(schema)) {
            _.set(file, context.path, value ? 1 : 0);
          }
        },
      });
    });
  });
};
