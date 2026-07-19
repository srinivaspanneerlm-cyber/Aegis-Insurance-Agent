import { adminService } from "../services/admin.service";
import catchAsync from "../utils/catchAsync";
import { sendSuccess } from "../utils/apiResponse";

const getDashboardStats = catchAsync(async (_req, res) => {
  const stats = await adminService.getStats();
  sendSuccess(res, 200, stats);
});

export { getDashboardStats };
