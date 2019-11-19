import fs from 'fs-extra';
import open from 'open';
import path from 'upath';
import { CommandGroup } from '../command';

export default class OpenCommand extends CommandGroup {
  protected args!: {
    query: string;
  };

  public register() {
    const command = 'open <query>';
    const describe = "Open selected directory in your system's file manager.";
    this.command({
      command,
      describe,
      handler: () => this.run(),
      builder: argv =>
        argv.usage(`$0 open <directory>/...

${describe}

Available base directories:
  \`.\` - root of your addon
  \`src\` - alias to \`./src\`
  \`game\` - \`game\` part of your addon inside \`dota 2 beta\` directory
  \`content\` - \`content\` part of your addon inside \`dota 2 beta\` directory
  \`scripts\` - alias to \`game/scripts\`
  \`vscripts\` - alias to \`scripts/vscripts\`
  \`panorama\` - alias to \`content/panorama\``),
    });
  }

  private async run() {
    const [from, ...components] = this.args.query.split('/');

    const dotaPath = await this.getDotaPath();
    const addonName = await this.getAddonName();

    let base;
    if (from === '.') {
      base = this.context;
    } else if (from === 'game' || from === 'content') {
      base = path.join(dotaPath, from, 'dota_addons', addonName);
    } else if (from === 'src') {
      base = path.join(this.context, 'src');
    } else if (from === 'scripts') {
      base = path.join(dotaPath, 'game', 'dota_addons', addonName, 'scripts');
    } else if (from === 'vscripts') {
      base = path.join(dotaPath, 'game', 'dota_addons', addonName, 'scripts', 'vscripts');
    } else if (from === 'panorama') {
      base = path.join(dotaPath, 'content', 'dota_addons', addonName, 'panorama');
    } else {
      throw new Error(`Unknown base directory: ${from}`);
    }

    let requestedPath = path.resolve(base, ...components);

    if (!(await fs.pathExists(requestedPath))) {
      throw new Error(`Could not find requested path: ${requestedPath}`);
    }

    if (!(await fs.stat(requestedPath)).isDirectory()) {
      requestedPath = path.dirname(requestedPath);
    }

    await open(requestedPath);
  }
}
