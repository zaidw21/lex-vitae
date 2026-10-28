/** An error whose message is safe to show to the user. Anything else is shown as a generic message. */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}
