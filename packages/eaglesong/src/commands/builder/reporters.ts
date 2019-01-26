import { Task, TaskState } from '@eaglesong/helper-task';
import chalk from 'chalk';
import logSymbols from 'log-symbols';
import readPkg from 'read-pkg';
import path from 'upath';

// @ts-ignore
const { version } = readPkg.sync({ cwd: path.join(__dirname, '../../..') });

function getTaskStateSymbol(state: TaskState) {
  switch (state) {
    case TaskState.Ok:
      return logSymbols.success;
    case TaskState.HasErrors:
      return logSymbols.error;
    case TaskState.HasWarnings:
      return logSymbols.warning;
    case TaskState.Working:
      return '?';
  }
}

function formatTaskErrors(context: string, indent: string, task: Task<any>) {
  return task.errors.map(err => {
    const file = err.file != null ? ' ' + path.relative(context, err.file) : '';
    const message = err.message.trim().replace(/\n/g, `\n   ${indent}`);
    const errLevel = err.level === 'error' ? chalk.bgRed('[E]') : chalk.bgYellow('[W]');
    return `${indent}${errLevel}${chalk.cyan(file)} ${message}`;
  });
}

export type Reporter = (context: string, tasks: Task<any>[]) => void;

const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
class ReportList {
  private tasks: Task<any>[] = [];
  private frame = 0;
  private timer?: NodeJS.Timer;
  constructor(private context: string) {}

  public setTasks(tasks: Task<any>[]) {
    this.tasks = tasks;
  }

  public update() {
    let text = `${chalk.green('Eaglesong')} v${version}\n\n`;

    if (this.timer == null && this.tasks.some(x => x.state === TaskState.Working)) {
      this.timer = setInterval(() => this.autoUpdate(), 80);
    }

    this.tasks.forEach(task => {
      const symbol = getTaskStateSymbol(task.state);
      text += symbol === '?' ? spinnerFrames[this.frame] : symbol;

      text += ' ';
      text += task.name;
      if (task.state !== TaskState.Working) {
        const errors = formatTaskErrors(this.context, ' ', task).join('\n');
        if (errors.length > 0) text += '\n' + errors;
      }
      text += '\n';
    });

    if (this.timer != null && this.tasks.every(x => x.state !== TaskState.Working)) {
      this.frame = 0;
      clearInterval(this.timer);
      this.timer = undefined;
    }

    console.clear();
    console.log(text.trim());
  }

  private autoUpdate() {
    this.frame = (this.frame + 1) % spinnerFrames.length;
    this.update();
  }
}

let defaultReporterReportList: ReportList | undefined;
const defaultReporter: Reporter = (context, tasks) => {
  if (!defaultReporterReportList) defaultReporterReportList = new ReportList(context);
  defaultReporterReportList.setTasks(tasks);
  defaultReporterReportList.update();
};

export const watchReporter = defaultReporter;

const simpleReporterLoggedTasks = new Set<Task<any>>();
const simpleReporter: Reporter = (context, tasks) =>
  tasks
    .filter(t => t.state !== TaskState.Working)
    .filter(t => !simpleReporterLoggedTasks.has(t))
    .forEach(task => {
      simpleReporterLoggedTasks.add(task);
      console.log(`${getTaskStateSymbol(task.state)} ${task.name}`);
      formatTaskErrors(context, ' ', task).forEach(line => console.log(line));
    });

export const buildReporter = simpleReporter;
