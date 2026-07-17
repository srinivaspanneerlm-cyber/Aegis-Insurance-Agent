const axios = require("axios");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const env = require("../config/env");

const AI_SERVICE_URL = env.AI_SERVICE_URL;

// Shared internal-service secret (sent when configured).
const internalHeaders = env.AI_INTERNAL_API_KEY
  ? { "X-Internal-Api-Key": env.AI_INTERNAL_API_KEY }
  : {};

/**
 * Proxies structured UI action events to the Python UI Action Engine.
 * Does NOT save to the database — button clicks are not chat messages.
 * Never triggers Intent Detection, Category Routing, or Recommendation Generation.
 */
const dispatchUIAction = catchAsync(async (req, res, next) => {
  const { type, action, session_id, plan_id, session_data } = req.body;

  if (!action) {
    return next(new AppError("'action' field is required", 400));
  }

  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/action`,
      { type: type || "ui_action", action, session_id, plan_id, session_data },
      { timeout: 10000, headers: internalHeaders }
    );

    res.status(200).json({
      status: "success",
      data: response.data,
    });
  } catch (error) {
    // Log the upstream detail, never echo it. A network failure puts the AI
    // service's host and port in `error.message`, and the engine's own errors
    // describe its internals — it takes care not to leak them to callers, and
    // relaying them here would undo that.
    const detail = error.response?.data?.detail || error.message;
    console.error("[UI Action] Engine call failed:", detail);

    // A 4xx means the caller's payload was wrong and they can act on it; the
    // status says which, without the message saying how we're built. Anything
    // else is ours to own, as a bad gateway.
    const status = error.response?.status;
    const isClientError = status >= 400 && status < 500;
    return next(
      isClientError
        ? new AppError("That action could not be processed. Please retry from the current screen.", status)
        : new AppError("The action service is unavailable right now. Please try again.", 502)
    );
  }
});

module.exports = { dispatchUIAction };
