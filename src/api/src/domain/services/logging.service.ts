import { Logger } from '@nestjs/common';

export class Context {
  module: string;
  action: string;
}

const APP_HOST = process.env.APP_HOST;

export class LoggerService extends Logger {
  logger(message: any, context?: Context) {
    const standard = {server: APP_HOST, type: 'INFO', time: new Date(Date.now()).toLocaleString()};
    const data = {...standard, ...context, message};
    super.log(data);
  }

  err(message: any, context: Context) {
    const standard = {server: APP_HOST, type: 'ERROR', time: new Date(Date.now()).toLocaleString()};
    const data = {...standard, ...context, message};
    super.error(data);
  }

  warning(message: any, context: Context) {
    const standard = {server: APP_HOST, type: 'WARNING', time: new Date(Date.now()).toLocaleString()};
    const data = {...standard, ...context, message};
    super.warn(data);
  }
}