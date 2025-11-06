export const asyncHandler = <T extends (...a: any[]) => Promise<any>>(fn: T) =>
  (req: any, res: any, next: any) => fn(req, res, next).catch(next);