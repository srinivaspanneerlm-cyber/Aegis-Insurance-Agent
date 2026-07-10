const express = require("express");
const { dispatchUIAction } = require("../controllers/ui_action.controller");
const { protect } = require("../middleware/auth.middleware");
const { aiLimiter } = require("../config/security");

const router = express.Router();

router.use(protect);

router.post("/", aiLimiter, dispatchUIAction);

module.exports = router;
