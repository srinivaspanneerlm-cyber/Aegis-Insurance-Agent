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
    const status = error.response?.status || 502;
    const detail = error.response?.data?.detail || error.message;
    return next(new AppError(`UI Action Engine error: ${detail}`, status));
  }
});

module.exports = { dispatchUIAction };
