import yaml from 'js-yaml';
import { promisify } from 'util';
import webpack from 'webpack';
import ModuleDependency from 'webpack/lib/dependencies/ModuleDependency';
import { makePathsRelative } from 'webpack/lib/util/identifier';
import WebpackError from 'webpack/lib/WebpackError';
import { XmlChunk } from '../HtmlWebpackXmlPlugin';
import { Entry, validateManifest } from './manifest';

class PanoramaManifestError extends WebpackError {
  public name = 'PanoramaManifestError';
  constructor(filename: string, message: string) {
    super(`Panorama manifest ${filename}\n${message}`);
  }
}

class PanoramaEntryDependency extends ModuleDependency {
  public get type() {
    return 'panorama entry';
  }
}

export class PanoramaManifestPlugin {
  constructor(private readonly manifestPath: string) {}

  public apply(compiler: webpack.Compiler) {
    compiler.options.entry = {};

    const { context } = compiler;
    const manifestPath = makePathsRelative(context, this.manifestPath);
    const readFile = promisify(compiler.inputFileSystem.readFile.bind(compiler.inputFileSystem));

    compiler.hooks.compilation.tap(
      this.constructor.name,
      (compilation, { normalModuleFactory }) => {
        compilation.dependencyFactories.set(PanoramaEntryDependency, normalModuleFactory);
      },
    );

    compiler.hooks.make.tapPromise(this.constructor.name, async (compilation) => {
      compilation.fileDependencies.add(this.manifestPath);
      const rawManifest = await readFile(this.manifestPath);

      let entries: Entry[];
      try {
        entries = yaml.safeLoad(rawManifest.toString('utf8')) ?? [];
      } catch (error) {
        compilation.errors.push(new PanoramaManifestError(manifestPath, error.message));
        return;
      }

      const valid = validateManifest(entries);
      if (!valid && validateManifest.errors != null) {
        for (const { dataPath, message } of validateManifest.errors) {
          compilation.errors.push(
            new PanoramaManifestError(manifestPath, `${dataPath} ${message}`),
          );
        }

        return;
      }

      const addEntry = promisify(compilation.addEntry.bind(compilation));
      await Promise.all(
        entries.map(async ({ source, name }) => {
          const dep = new PanoramaEntryDependency(source);
          dep.loc = { name };
          await addEntry(context, dep, name);
        }),
      );

      compilation.hooks.reviveChunks.tap(this.constructor.name, (chunks) => {
        for (const chunk of chunks) {
          const entry = entries.find((e) => e.name === chunk.name);
          if (entry?.type != null) {
            (chunk as XmlChunk).__type = entry.type;
          }
        }
      });
    });
  }
}
