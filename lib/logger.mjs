class StructuredLogger {
  constructor(service) {
    this.service = service;
  }

  _log(level, message, context = {}) {
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      message,
      ...context,
    };
    const stream = level === "error" ? process.stderr : process.stdout;
    stream.write(`${JSON.stringify(payload)}\n`);
  }

  debug(message, context) { this._log("debug", message, context); }
  info(message, context) { this._log("info", message, context); }
  warn(message, context) { this._log("warn", message, context); }
  error(message, context) { this._log("error", message, context); }

  child(context) {
    const child = Object.create(this);
    child._childContext = { ...this._childContext, ...context };
    return child;
  }
}

export function createLogger(service = "trakagile") {
  return new StructuredLogger(service);
}

export default createLogger;
