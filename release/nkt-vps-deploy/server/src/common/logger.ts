import pino from 'pino';
import { config } from '../config/index.js';

export const logger = pino({
  level: config.isProduction ? 'info' : 'debug',
  transport: config.isProduction
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true } },
});
