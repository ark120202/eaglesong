import { TransformTask } from '@eaglesong/helper-task';
import fs from 'fs-extra';
import { imageSize } from 'image-size';
import path from 'upath';
import { promisify } from 'util';

export interface Options {
  verifySizes?: SizeRule[] | false;
}

export interface SizeRule {
  name: string;
  test: RegExp | string[] | ((filePath: string, content: Buffer) => boolean);
  sizes: [number, number][];
}

export default class ImagesTask extends TransformTask<Options> {
  protected pattern = 'src/images/**/*';
  private srcPath!: string;

  constructor(options: Options = {}) {
    super(options);
  }

  public apply() {
    super.apply();
    this.srcPath = this.resolvePath('src/images');

    this.hooks.build.tapPromise(this.constructor.name, async () => {
      if (this.dotaPath != null) {
        await fs.ensureDir(this.srcPath);
        await fs.ensureSymlink(this.srcPath, this.resolvePath('game', 'resource/flash3/images'));
      }
    });
  }

  protected async transformFile(filePath: string) {
    if (path.extname(filePath) !== '.png') {
      this.error({ filePath, message: 'File format is not supported, use PNG.' });
      return;
    }

    const content = await fs.readFile(filePath);
    const fileName = path.relative(this.srcPath, filePath);

    await this.verifyFile(filePath, fileName, content);
  }

  private async verifyFile(filePath: string, fileName: string, content: Buffer) {
    const verifySizes: SizeRule[] = [];
    if (Array.isArray(this.options.verifySizes)) {
      verifySizes.push(...this.options.verifySizes);
    } else if (this.options.verifySizes == null) {
      verifySizes.push(
        { name: 'items', test: ['items'], sizes: [[88, 64]] },
        { name: 'spellicons', test: ['spellicons'], sizes: [[128, 128]] },
      );
    }

    const rules = verifySizes.filter(({ test }) => {
      if (Array.isArray(test)) {
        const parts = fileName.split(/\//g);
        return test.every((value, index) => parts[index] === value);
      }

      return typeof test === 'function' ? test(filePath, content) : test.test(filePath);
    });

    if (rules.length === 0) return;

    let realSizes: [number, number];
    try {
      const { width, height } = (await promisify(imageSize)(filePath))!;
      // @ts-ignore Is it really nullable?
      realSizes = [width, height];
    } catch (error) {
      this.error({ filePath, message: error.toString() });
      return;
    }

    for (const rule of rules) {
      if (!rule.sizes.some((x) => x[0] === realSizes[0] && x[1] === realSizes[1])) {
        this.error({
          filePath,
          level: 'warning',
          message: `Image has ${realSizes[0]}x${realSizes[1]} size, which not matches ${rule.name} rule.`,
        });
      }
    }
  }
}
