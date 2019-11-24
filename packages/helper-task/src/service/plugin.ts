import { ServiceErrorReporter, ServiceProvider } from '.';

export type TriggerChange = (fileName: string) => void;
export interface ServicePluginApi {
  serviceProvider: ServiceProvider;
  error: ServiceErrorReporter;
  triggerChange: TriggerChange;
  context: string;
}
