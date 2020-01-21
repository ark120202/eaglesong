import { Task, TaskState } from '@eaglesong/helper-task';
import chalk from 'chalk';
import logSymbols from 'log-symbols';
import readPkg from 'read-pkg';
import path from 'upath';

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

const formatTaskErrors = (context: string, indent: string, task: Task<any>) =>
  task.errors.map(error => {
    const filePath = error.filePath != null ? ` ${path.relative(context, error.filePath)}` : '';
    const message = error.message.trim().replace(/\n/g, `\n   ${indent}`);
    const level = error.level === 'error' ? chalk.bgRed('[E]') : chalk.bgYellow('[W]');

    return `${indent}${level}${chalk.cyan(filePath)} ${message}`;
  });

export type Reporter = (context: string, tasks: Task<any>[]) => void;

class ReportList {
  private tasks: Task<any>[] = [];
  constructor(private readonly context: string) {}

  public setTasks(tasks: Task<any>[]) {
    this.tasks = tasks;
  }

  public update() {
    let text = `${chalk.green('Eaglesong')} v${version}\n\n`;

    for (const task of this.tasks) {
      text += getTaskStateSymbol(task.state);

      text += ' ';
      text += task.name;

      if (task.state !== TaskState.Working) {
        const errors = formatTaskErrors(this.context, ' ', task).join('\n');
        if (errors.length > 0) text += `\n${errors}`;
      }

      text += '\n';
    }

    if (!process.env.EAGLESONG_NO_CLEAR) {
      console.clear();
    }

    console.log(text.trim());
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
