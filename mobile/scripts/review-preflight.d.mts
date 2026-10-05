export function runReviewPreflight(options: {
  base: string;
  fetchImpl?: typeof fetch;
  log?: (message: string) => void;
  errorLog?: (message: string) => void;
}): Promise<boolean>;
