export class AppError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}
export const forbidden = (msg = "Keine Berechtigung.") => new AppError("forbidden", msg, 403);
export const notFound = (msg = "Nicht gefunden.") => new AppError("not_found", msg, 404);
export const conflict = (msg: string) => new AppError("conflict", msg, 409);
export const bad = (msg: string) => new AppError("bad_request", msg, 400);
