import { TransformTask } from '@eaglesong/helper-task';
import fs from 'fs-extra';
import _ from 'lodash';
import pProps from 'p-props';
import path from 'upath';
import { SoundEvents, soundEventsSchema, validateSoundEvents } from './soundevents';

const toOperatorVariableValues = (value: Record<string, unknown>) =>
  _.mapValues(value, x => (x == null ? x : toOperatorVariableValue(x)));

function toOperatorVariableValue(value: unknown) {
  if (Array.isArray(value)) value = Object.fromEntries(value.map((v, i) => [`value${i}`, v]));
  if (typeof value === 'boolean') value = value ? 1 : 0;

  return { value };
}

const SUPPORTED_AUDIO_EXTENSIONS = ['.mp3', '.wav'];
export default class SoundsTask extends TransformTask<void> {
  protected pattern = 'src/sounds/**/*.yml';
  private srcPath!: string;

  public apply() {
    this.srcPath = this.resolvePath('src/sounds');

    this.hooks.preBuild.tapPromise(this.constructor.name, async () => {
      const schemaPath = this.resolvePath('.eaglesong/schemas/soundevents.json');
      await fs.outputJson(schemaPath, soundEventsSchema, { spaces: 2 });
    });

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
    const valid = validateSoundEvents(content);
    if (!valid && validateSoundEvents.errors != null) {
      for (const { dataPath, message } of validateSoundEvents.errors) {
        this.error({ filePath, message: `${dataPath} ${message}` });
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
    const fileName = path.changeExt(path.relative(this.srcPath, filePath), '.vsndevts');
    return this.resolvePath('content', `soundevents/${fileName}`);
  }

  private async mapFiles(filePath: string, files: string[]) {
    const fileDirectory = path.dirname(filePath);
    return Promise.all(
      files.map(async fileName => {
        if (typeof fileName !== 'string') return '';

        const extension = path.extname(fileName);
        const isRoot = fileName.startsWith('/');
        if (isRoot || fileName.startsWith('./')) {
          let absolute = path.resolve(
            isRoot ? this.srcPath : fileDirectory,
            fileName.slice(isRoot ? 1 : 0),
          );

          if (!(await fs.pathExists(absolute))) {
            this.error({ filePath, message: `Could not find '${fileName}'` });
          } else if (!SUPPORTED_AUDIO_EXTENSIONS.includes(extension)) {
            this.error({
              filePath,
              message: `'${fileName}' has an unsupported '${extension}' extension`,
            });
          }

          absolute = path.changeExt(absolute, '.vsnd');
          return `sounds/custom_game/${path.relative(this.srcPath, absolute)}`;
        }

        if (fileName.startsWith('sounds')) {
          if (extension !== '.vsnd') {
            this.error({
              filePath,
              message: `'${fileName}' is expected to have a .vsnd extension`,
            });
          }
        } else {
          this.error({
            filePath,
            message: `'${fileName}' is invalid. Files should start with a './' (from current file), '/' (from root) or 'sounds' (no resolution)`,
          });
        }

        return fileName;
      }),
    );
  }
}
