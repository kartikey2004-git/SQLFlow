import type { Response } from "express";

const streams = new Set<Response>();

export const registerStream = (res: Response) => {
  streams.add(res);
  res.on("close", () => streams.delete(res));
};

export const closeAllStreams = () => {
  for (const res of streams) {
    try {
      res.write(`event: shutdown\ndata: {}\n\n`);
      res.end();
    } catch {
    }
  }
  streams.clear();
};
