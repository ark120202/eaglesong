## Development Environment

To use Eaglesong you have to get [Node.js](https://nodejs.org/) (>= 12).

Optionally, you also might want to get [yarn](https://yarnpkg.com/en/docs/install), a recommended
package manager.

If you want to publish your addon with `eaglesong publish`, you also have to get few
[additional requirements](/commands/publish#additional-requirements).

## Editor Support

|         Name         |        Free        |         TypeScript          |    JSON Schema     |    YAML Schema     |         ESLint         |      Prettier       |
| :------------------: | :----------------: | :-------------------------: | :----------------: | :----------------: | :--------------------: | :-----------------: |
| [Visual Studio Code] | :heavy_check_mark: |     :heavy_check_mark:      | :heavy_check_mark: |   [vscode-yaml]    |    [vscode-eslint]     |  [prettier-vscode]  |
|      [WebStorm]      |        :x:         |     :heavy_check_mark:      | :heavy_check_mark: | :heavy_check_mark: |   :heavy_check_mark:   | :heavy_check_mark:  |
|        [Atom]        | :heavy_check_mark: |      [atom-typescript]      | [atom-json-schema] |        :x:         |    [linter-eslint]     |   [prettier-atom]   |
|    [Sublime Text]    |        :x:         | [TypeScript-Sublime-Plugin] |        :x:         |        :x:         | [SublimeLinter-eslint] | [SublimeJsPrettier] |

[visual studio code]: https://code.visualstudio.com/
[vscode-yaml]: https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml
[vscode-eslint]: https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint
[prettier-vscode]: https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode
[webstorm]: https://www.jetbrains.com/webstorm/
[atom]: https://atom.io/
[atom-typescript]: https://atom.io/packages/atom-typescript
[atom-json-schema]: https://atom.io/packages/json-schema
[linter-eslint]: https://atom.io/packages/linter-eslint
[prettier-atom]: https://atom.io/packages/prettier-atom
[sublime text]: https://www.sublimetext.com/
[typescript-sublime-plugin]: https://packagecontrol.io/packages/TypeScript
[sublimelinter-eslint]: https://packagecontrol.io/packages/SublimeLinter-eslint
[sublimejsprettier]: https://packagecontrol.io/packages/JsPrettier

## DevOps

To validate addon files within Continuous Integration pipeline you can use a
[`eaglesong build --no-dota`](/commands/build/) command. It builds addon without trying to find Dota
2 client, which would make it just check source files. As an example, custom games initialized with
[`@eaglesong/create-custom-game`](/getting-started) with `git` installed include a
[GitHub Actions](https://github.com/features/actions) workflow.

[`eaglesong publish`](/commands/publish) should make it possible to be used in a CD pipeline on a
Windows Server environment, however currently there are no working examples.
