import execa from 'execa';
import fs from 'fs-extra';
import globby from 'globby';
import _ from 'lodash';
import tempWrite from 'temp-write';
import path from 'upath';

export class ResourceCompiler {
  private readonly patterns: string[] = [];
  private readonly contentPath: string;
  constructor(private readonly dotaPath: string, addonName: string) {
    this.contentPath = path.join(dotaPath, 'content', 'dota_addons', addonName);
  }

  public addResource(patterns: string | string[]) {
    this.patterns.push(..._.castArray(patterns));
  }

  public async compile() {
    const compilerPath = `${this.dotaPath}/game/bin/win64/resourcecompiler.exe`;
    const args: string[] = [];

    const files = await globby(this.patterns, { cwd: this.contentPath, dot: true });
    // resourcecompiler fails when there are no files
    if (files.length === 0) return;

    const fileListPath = await tempWrite(files.join('\n'));
    args.push('-filelist', fileListPath);
    try {
      await execa(compilerPath, args, { cwd: this.contentPath, stdio: 'inherit' });
      return true;
    } catch {
      return false;
    } finally {
      await fs.remove(fileListPath);
    }
  }
}
