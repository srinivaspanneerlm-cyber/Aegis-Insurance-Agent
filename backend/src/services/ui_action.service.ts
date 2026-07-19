import axios, { type AxiosError } from "axios";
import env from "../config/env";
import AppError from "../utils/appError";
import { logger } from "../config/logger";

const AI_SERVICE_URL = env.AI_SERVICE_URL;

const internalHeaders: Record<string, string> = env.AI_INTERNAL_API_KEY
  ? { "X-Internal-Api-Key": env.AI_INTERNAL_API_KEY }
  : {};

interface UIActionInput {
  type?: string;
  action: string;
  session_id?: string;
  plan_id?: string;
  session_data?: Record<string, unknown>;
}

export const uiActionService = {
  /**
   * Structured button-click dispatcher — proxies to the AI engine's /action.
   * Never echoes upstream detail to the caller (host/port + engine internals);
   * it is logged server-side only.
   */
  async dispatch({ type, action, session_id, plan_id, session_data }: UIActionInput) {
    try {
      const response = await axios.post(
        `${AI_SERVICE_URL}/action`,
        { type: type || "ui_action", action, session_id, plan_id, session_data },
        { timeout: 10000, headers: internalHeaders }
      );
      return response.data;
    } catch (error) {
      const err = error as AxiosError<{ detail?: string }>;
      const detail = err.response?.data?.detail || err.message;
      logger.warn({ detail }, "[UI Action] Engine call failed");

      const status = err.response?.status;
      const isClientError = status !== undefined && status >= 400 && status < 500;
      throw isClientError
        ? new AppError("That action could not be processed. Please retry from the current screen.", status as number)
        : new AppError("The action service is unavailable right now. Please try again.", 502);
    }
  },
};
