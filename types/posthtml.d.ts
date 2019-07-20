declare module 'posthtml' {
  import * as htmlparser2 from 'htmlparser2';

  function posthtml(plugins?: ReadonlyArray<posthtml.Plugin>): posthtml.PostHTML;
  namespace posthtml {
    type Parser<T = htmlparser2.Options> = (html: string, options?: ParserOptions<T>) => Node[];
    type ParserOptions<T = htmlparser2.Options> = {
      directives?: { name: string | RegExp; start: string; end: string }[];
    } & T;

    type Render = (tree: NodeTree, options?: RenderOptions) => string;
    interface RenderOptions {
      singleTags?: (string | RegExp)[];
      closingSingleTag?: 'tag' | 'slash' | 'default';
    }

    type Options<T = htmlparser2.Options> = ParserOptions<T> &
      RenderOptions & {
        sync?: boolean;
        skipParse?: boolean;
        parser?: Parser<T>;
        render?: Render;
      };

    interface Node {
      tag: string | false;
      attrs: Record<string, string | undefined>;
      content: NodeTree;
    }

    interface Message {
      type: string;
    }

    interface PostHTMLConstructor {
      parser: Parser;
      render: Render;
      new (plugins: Plugin[]): PostHTML;
    }

    interface PostHTML {
      constructor: PostHTMLConstructor;

      version: string;
      name: string;
      plugins: Plugin[];
      messages: Message[];

      use(plugin: Plugin): this;
      process<T = htmlparser2.Options>(
        html: string | NodeTree,
        options: Options<T> & { sync: true },
      ): Result;
      process<T = htmlparser2.Options>(
        html: string | NodeTree,
        options?: Options<T>,
      ): Promise<Result>;
    }

    interface Result {
      html: string;
      tree: NodeTree;
      messages: Message[];
    }

    type NodeTreeElement = Node | string | false;
    type NodeTree = NodeTreeElement[];
    interface NodeMatchExpression {
      tag?: string | false;
      attrs?: Record<string, boolean>;
      content?: (string | RegExp | NodeMatchExpression)[];
    }

    interface Api extends NodeTree {
      version: string;
      name: string;
      plugins: Plugin[];
      messages: Message[];

      walk(cb: (node: NodeTreeElement) => NodeTreeElement): void;
      match(expression: string | RegExp, cb: (node: string) => NodeTreeElement): void;
      match(
        expression: NodeMatchExpression | ReadonlyArray<NodeMatchExpression>,
        cb: (node: Node) => NodeTreeElement,
      ): void;
    }

    type Plugin =
      | ((tree: Api) => NodeTree | Promise<NodeTree>)
      | ((
          tree: Api,
          cb: ((err: Error) => void) | ((err: null | undefined, tree: NodeTree) => void),
        ) => void);
  }

  export = posthtml;
}

declare module 'posthtml-parser' {
  import { Parser } from 'posthtml';

  const parser: Parser;
  export = parser;
}

declare module 'posthtml-render' {
  import { Render } from 'posthtml';

  const render: Render;
  export = render;
}

declare module '@posthtml/esm' {
  import { Plugin } from 'posthtml';

  export function urls(options?: UrlsOptions): Plugin;
  export interface UrlsOptions {
    url?: string | RegExp | ((url: string) => boolean);
  }

  export function imports(options?: ImportsOptions): Plugin;
  export interface ImportsOptions {
    import?: string | RegExp | ((url: string) => boolean);
    template?: string;
  }

  export interface ImportMessage {
    type: 'import';
    plugin: '@posthtml/esm';
    url: string;
    name: string;
    import(): string;
  }
}
