import { TransformTask } from '@eaglesong/helper-task';
import fs from 'fs-extra';
import { imageSize } from 'image-size';
import path from 'upath';

export interface SizeGroup {
  name: string;
  test: RegExp | string[] | ((filePath: string, content: Buffer) => boolean);
  sizes: [number, number][];
}

export interface Options {
  verifySizes?: SizeGroup[] | false;
  transform?(content: Buffer, filePath: string): Buffer | boolean | void;
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
  }

  protected async transformFile(filePath: string) {
    if (path.extname(filePath) !== '.png') {
      this.error(filePath, 'File format is not supported. Use PNG.');
      return;
    }

    let content = await fs.readFile(filePath);
    const fileName = path.relative(this.srcPath, filePath);
    if (this.options.transform) {
      const transformResult = this.options.transform(content, fileName);
      if (Buffer.isBuffer(transformResult)) {
        content = transformResult;
      } else if (transformResult === false) {
        return;
      }
    }

    if (!this.verifyFile(filePath, fileName, content)) return;
    if (this.dotaPath == null) return;

    await fs.outputFile(this.getDestinationPath(filePath), content);
  }

  protected async removeFile(filePath: string) {
    await fs.remove(this.getDestinationPath(filePath));
  }

  private getDestinationPath(filePath: string) {
    const fileName = path.changeExt(path.relative(this.srcPath, filePath), '.png');
    return this.resolvePath('game', `resource/flash3/images/${fileName}`);
  }

  private verifyFile(fullPath: string, fileName: string, content: Buffer) {
    const verifySizes: SizeGroup[] = [];
    if (Array.isArray(this.options.verifySizes)) {
      verifySizes.push(...this.options.verifySizes);
    } else if (this.options.verifySizes == null) {
      verifySizes.push(
        { name: 'items', test: ['items'], sizes: [[88, 64]] },
        { name: 'spellicons', test: ['spellicons'], sizes: [[128, 128]] },
      );
    }

    const eSizes = verifySizes.find(({ test }) => {
      if (Array.isArray(test)) {
        const parts = fileName.split(/\//g);
        return test.every((value, index) => parts[index] === value);
      }

      return typeof test === 'function' ? test(fullPath, content) : test.test(fullPath);
    });

    if (!eSizes) return true;

    let rSizes: [number, number];
    try {
      const { width, height } = imageSize(content);
      // @ts-ignore Is it really nullable?
      rSizes = [width, height];
    } catch (error) {
      this.error(fullPath, error.message);
      return false;
    }

    if (!eSizes.sizes.some(x => x[0] === rSizes[0] && x[1] === rSizes[1])) {
      this.error(
        fullPath,
        `Image has ${rSizes[0]}x${rSizes[1]} size, which not matches ${eSizes.name} rule.`,
        'warning',
      );
    }

    return true;
  }
}
