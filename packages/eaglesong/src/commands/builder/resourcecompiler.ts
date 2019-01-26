import execa from 'execa';
import globby from 'globby';
import _ from 'lodash';
import tempWrite from 'temp-write';
import path from 'upath';

export class ResourceCompiler {
  private patterns: string[] = [];
  private contentPath: string;
  public constructor(private dotaPath: string, addonName: string) {
    this.contentPath = path.join(dotaPath, 'content', 'dota_addons', addonName);
  }

  public addResource(patterns: string | string[]) {
    this.patterns.push(..._.castArray(patterns));
  }

  public async compile() {
    const useWine = process.platform !== 'win32';
    const compilerPath = `${this.dotaPath}/game/bin/win64/resourcecompiler.exe`;

    const args: string[] = [];
    const executable = useWine ? 'wine' : compilerPath;
    if (useWine) args.push(compilerPath);

    const files = await globby(this.patterns, { cwd: this.contentPath, dot: true });
    // resourcecompiler fails when there are no files
    if (files.length === 0) return;

    const fileListPath = await tempWrite(files.join('\n'));
    args.push('-filelist', fileListPath);
    await execa(executable, args);
  }
}
