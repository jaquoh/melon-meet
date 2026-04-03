import { HTTPException } from "hono/http-exception";

export function assertOrThrow(
  condition: unknown,
  status: number,
  message: string,
): asserts condition {
  if (!condition) {
    throw new HTTPException(status as never, { message });
  }
}

export function notFound(message = "Not found.") {
  throw new HTTPException(404, { message });
}
