/** A failure explained to the user: the CLI prints the message and exits with code 1. */
export class AtlasError extends Error {}

/** GitHub refuses every further request: an organization's scan ends instead of going on. */
export class LimitError extends AtlasError {}
