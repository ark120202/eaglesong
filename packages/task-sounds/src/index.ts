import { TransformTask } from '@eaglesong/helper-task';
import Ajv from 'ajv';
import fs from 'fs-extra';
import _ from 'lodash';
import pProps from 'p-props';
import path from 'upath';
import { schema, SoundEvents } from './soundevents.schema';

const ajv = new Ajv({ allErrors: true, useDefaults: true });
const compiledSchema = ajv.compile(schema);

const toOperatorVariableValues = (value: Record<string, unknown>) =>
  _.mapValues(value, x => (x == null ? x : toOperatorVariableValue(x)));

function toOperatorVariableValue(value: unknown) {
  if (Array.isArray(value)) value = _.fromPairs(value.map((v, i) => [`value${i}`, v]));
  if (typeof value === 'boolean') value = value ? 1 : 0;

  return { value };
}

const SUPPORTED_AUDIO_EXTENSIONS = ['.mp3', '.wav'];
export default class SoundsTask extends TransformTask<void> {
  protected pattern = 'src/sounds/**/*.yml';
  private srcPath!: string;

  constructor() {
    super(undefined);
  }

  public apply() {
    this.srcPath = this.resolvePath('src/sounds');

    this.hooks.build.tapPromise(this.constructor.name, async () => {
      if (this.dotaPath != null) {
        await fs.ensureDir(this.srcPath);
        await fs.ensureSymlink(this.srcPath, this.resolvePath('content', 'sounds/custom_game'));
      }
    });

    this.hooks.compile.tap(this.constructor.name, addResource =>
      addResource([
        'soundevents/**/*',
        `sounds/custom_game/**/*.{${SUPPORTED_AUDIO_EXTENSIONS.join(',')}}`,
      ]),
    );

    super.apply();
  }

  protected async transformFile(filePath: string) {
    const content: SoundEvents = await this.import(filePath);
    const valid = compiledSchema(content);
    if (!valid && compiledSchema.errors != null) {
      for (const { message, dataPath } of compiledSchema.errors) {
        this.error(filePath, `${dataPath} ${message}`);
      }
    }

    const data = await pProps(content, async soundEvent => {
      if (!_.isObjectLike(soundEvent)) return;

      const { files, type, ...variables } = soundEvent;
      const fileList = await this.mapFiles(filePath, _.castArray(files));

      const referenceOperator = {
        operator: 'sos_reference_stack',
        reference_stack: type,
        operator_variables: toOperatorVariableValues({
          ...variables,
          vsnd_files: fileList,
        }),
      };

      return { operator_stacks: { update_stack: { reference_operator: referenceOperator } } };
    });

    if (this.dotaPath != null) await this.outputKV1(this.resolveResultPath(filePath), data);
  }

  protected async removeFile(filePath: string) {
    await fs.remove(this.resolveResultPath(filePath));
  }

  private resolveResultPath(filePath: string) {
    const fileName = path.relative(filePath, this.srcPath);
    return this.resolvePath('content', `soundevents/${path.changeExt(fileName, '.vsndevts')}`);
  }

  private async mapFiles(filePath: string, files: string[]) {
    const fileDirectory = path.dirname(filePath);
    return Promise.all(
      files.map(async x => {
        if (typeof x !== 'string') return '';

        const extension = path.extname(x);
        const isRoot = x.startsWith('/');
        if (isRoot || x.startsWith('./')) {
          let absolute = path.resolve(
            isRoot ? this.srcPath : fileDirectory,
            x.substring(isRoot ? 1 : 0),
          );

          if (!SUPPORTED_AUDIO_EXTENSIONS.includes(extension)) {
            this.error(filePath, `${x} has an unsupported ${extension} extension`);
          } else if (!(await fs.pathExists(absolute))) {
            this.error(filePath, `Couldn't resolve ${x}`);
          }

          absolute = path.changeExt(absolute, '.vsnd');
          return `sounds/custom_game/${path.relative(this.srcPath, absolute)}`;
        }

        if (x.startsWith('sounds')) {
          if (extension !== '.vsnd') {
            this.error(filePath, `${x} expected to have a .vsnd extension`);
          }
        } else {
          this.error(
            filePath,
            `${x} is invalid. Files should start with a ` +
              '"./" (file-relative), "/" (root-relative) or "sounds" (no special handling)',
          );
        }

        return x;
      }),
    );
  }
}
