import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { analyzeSignal } from "./typesafe";

export const appRouter = router({
  signal: router({
    analyze: publicProcedure
      .input(
        z.object({
          productNote: z.string().trim().min(12).max(1200),
        })
      )
      .mutation(({ input }) => analyzeSignal(input.productNote)),
  }),
});

export type AppRouter = typeof appRouter;
