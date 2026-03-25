import { supabase } from "@/integrations/supabase/client";

type SetupVerificationBody = Record<string, unknown>;

export class SetupVerificationTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`setup-verification timed out after ${timeoutMs}ms`);
    this.name = "SetupVerificationTimeoutError";
  }
}

export const isSetupVerificationTimeoutError = (error: unknown) =>
  error instanceof SetupVerificationTimeoutError;

export const invokeSetupVerification = async <T = any>(
  body: SetupVerificationBody,
  timeoutMs = 8000,
): Promise<T> => {
  let timeoutId: number | null = null;

  try {
    const result = await Promise.race([
      supabase.functions.invoke("setup-verification", {
        body,
      }) as Promise<{ data: T | null; error: Error | null }>,
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(new SetupVerificationTimeoutError(timeoutMs));
        }, timeoutMs);
      }),
    ]);

    if (result.error) throw result.error;
    return (result.data ?? {}) as T;
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  }
};