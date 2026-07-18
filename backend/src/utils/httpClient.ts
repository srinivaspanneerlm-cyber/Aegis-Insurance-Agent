/**
 * Resilient HTTP client factory.
 *
 * Wraps axios with a centralised timeout and an optional exponential-backoff
 * retry policy for transient failures (network errors, timeouts, 5xx). Retries
 * are OFF by default and must be opted into per client, because retrying a
 * non-idempotent call (e.g. the AI dispatch, which has memory side-effects) can
 * cause double-processing. Enable retries only for idempotent endpoints
 * (health checks, GETs, future Payment/DocVerification idempotent APIs).
 */
import axios, { type AxiosError, type AxiosInstance, type AxiosRequestConfig } from "axios";
import { AI_CLIENT } from "../config/constants";

function isRetriable(error: AxiosError): boolean {
  if (!error.response) return true; // network error / timeout / no response
  return error.response.status >= 500; // upstream server error
}

interface HttpClientOptions extends AxiosRequestConfig {
  timeout?: number;
  retries?: number;
  retryBaseDelayMs?: number;
}

export function createHttpClient({
  timeout = AI_CLIENT.TIMEOUT_MS,
  retries = 0,
  retryBaseDelayMs = AI_CLIENT.RETRY_BASE_DELAY_MS,
  ...axiosOptions
}: HttpClientOptions = {}): AxiosInstance {
  const instance = axios.create({ timeout, ...axiosOptions });

  if (retries > 0) {
    instance.interceptors.response.use(undefined, async (error: AxiosError) => {
      const config = (error.config || {}) as AxiosRequestConfig & { __retryCount?: number };
      config.__retryCount = config.__retryCount || 0;
      if (config.__retryCount >= retries || !isRetriable(error)) {
        return Promise.reject(error);
      }
      config.__retryCount += 1;
      const delay = retryBaseDelayMs * 2 ** (config.__retryCount - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return instance(config);
    });
  }

  return instance;
}
