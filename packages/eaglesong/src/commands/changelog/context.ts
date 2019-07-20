interface ChangelogGroup {
  context: ChangelogContext;
  setSorter(sort: (a: ChangelogGroupImpl, b: ChangelogGroupImpl) => number): void;
  group(name: string): ChangelogGroup;
  addLine(line: string): void;
}

type ChangelogContext = ChangelogGroup;

export class ChangelogGroupImpl implements ChangelogContext {
  public context = this;

  constructor(public readonly name: string) {}

  private sorter?(a: ChangelogGroupImpl, b: ChangelogGroupImpl): number;
  public setSorter(sort: (a: ChangelogGroupImpl, b: ChangelogGroupImpl) => number) {
    this.sorter = sort;
  }

  private readonly groups = new Map<string, ChangelogGroupImpl>();
  public group(name: string) {
    if (this.groups.has(name)) return this.groups.get(name)!;
    const group = new ChangelogGroupImpl(name);
    this.groups.set(name, group);
    return group;
  }

  private readonly lines: string[] = [];
  public addLine(line: string) {
    this.lines.push(line);
  }

  public toMarkdown(): string {
    const groups = [...this.groups.values()];
    if (this.sorter) groups.sort(this.sorter);
    return [...this.lines, ...groups.map(x => x.toMarkdown())].join('\n\n');
  }
}

export class ChangelogContextImpl extends ChangelogGroupImpl {
  constructor() {
    super('');
  }
}
