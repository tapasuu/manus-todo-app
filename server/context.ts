import type { Request, Response } from "express";
import type { User } from "../drizzle/schema";

export type TrpcContext = {
  user: User | null;
  req: Request;
  res: Response;
};
