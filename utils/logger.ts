/**
 * SopranoChat — Production-Safe Logger
 * ═══════════════════════════════════
 * Production build'de console çıktısını tamamen susturur.
 * __DEV__ kontrolünü her yerde tekrar yazmak yerine bu modülü kullanın.
 *
 * Kullanım:
 *   import { logger } from '../utils/logger';
 *   logger.warn('bir şey oldu', detail);
 *   logger.error('hata', err);
 */

const noop = (..._args: any[]) => {};

export const logger = {
  log: __DEV__ ? console.log.bind(console) : noop,
  warn: __DEV__ ? console.warn.bind(console) : noop,
  error: __DEV__ ? console.error.bind(console) : noop,
  info: __DEV__ ? console.info.bind(console) : noop,
  debug: __DEV__ ? console.debug.bind(console) : noop,
};

export default logger;
