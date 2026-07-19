import { uiActionService } from "../services/ui_action.service";
import catchAsync from "../utils/catchAsync";
import AppError from "../utils/appError";
import { sendSuccess } from "../utils/apiResponse";

/**
 * Proxies structured UI action events to the Python UI Action Engine.
 * Does NOT save to the database — button clicks are not chat messages.
 * Never triggers Intent Detection, Category Routing, or Recommendation Generation.
 */
const dispatchUIAction = catchAsync(async (req, res, next) => {
  if (!req.body.action) {
    return next(new AppError("'action' field is required", 400));
  }
  const data = await uiActionService.dispatch(req.body);
  sendSuccess(res, 200, data);
});

export { dispatchUIAction };
