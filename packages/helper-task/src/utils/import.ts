import fs from 'fs-extra';
import yaml from 'js-yaml';
import parseJson from 'json-parse-better-errors';
import _ from 'lodash';
import stripJsonComments from 'strip-json-comments';
import path from 'upath';

export async function _import(id: string): Promise<any> {
  const extension = path.extname(id);

  let content: string;
  let result: any;
  switch (extension) {
    case '.yml':
    case '.yaml':
      content = await fs.readFile(id, 'utf8');
      result = yaml.safeLoad(content, { filename: id });
      return result != null ? result : {};
    case '.json':
      content = await fs.readFile(id, 'utf8');
      return parseJson(stripJsonComments(content));

    case '.ts':
    case '.tsx':
    // @ts-ignore
    case '.jsx':
      // tslint:disable-next-line: deprecation
      if (require.extensions['.ts'] == null) {
        // Type checking and linting is done in a plugin
        // tslint:disable-next-line: no-implicit-dependencies
        (await import('ts-node')).register({ transpileOnly: true });
      }
    case '.js':
      const resolved = require.resolve(id);
      // TODO: Consider using decache
      delete require.cache[resolved];
      result = require(resolved);
      const copy = _.clone(result);
      if (result.__esModule) copy.__esModule = true;
      return copy;
    default:
      throw new Error(`Extension ${extension} is not supported`);
  }
}
