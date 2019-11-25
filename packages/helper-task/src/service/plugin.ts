import { ServiceErrorReporter } from '.';
import { TaskProvider } from '../tasks';

export interface ServicePluginApi {
  taskProvider: TaskProvider;
  error: ServiceErrorReporter;
  context: string;
}
