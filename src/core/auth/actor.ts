/**
 * The authenticated person making a request.
 *
 * Resolved from the session on the server, on every request. Services receive
 * an Actor and derive every access decision from it — never from an id, role or
 * owner field supplied by the client.
 */
export interface Actor {
  id: string;
  name: string;
  username: string;
  role: string;
  mustChangePassword: boolean;
}

/** The only user fields ever selected for an Actor. No hash, ever. */
export const ACTOR_SELECT = {
  id: true,
  name: true,
  username: true,
  role: true,
  status: true,
  mustChangePassword: true,
} as const;
