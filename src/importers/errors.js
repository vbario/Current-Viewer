/** A friendly, user-facing import failure. `message` is safe to show as-is. */
export class ImportError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'ImportError';
    if (details !== undefined) this.details = details;
  }
}
