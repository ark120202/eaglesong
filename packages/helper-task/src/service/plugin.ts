import { ServiceErrorReporter, ServiceProvider } from '.';

export interface ServicePluginApi {
  serviceProvider: ServiceProvider;
  error: ServiceErrorReporter;
  context: string;
}
