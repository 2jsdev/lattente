const express = require("express");
const pagesController = require("../controllers/pagesController");

const router = express.Router();

router.get("/creations", pagesController.creationsRedirect);
router.get("/", pagesController.home);
router.get("/menu", pagesController.menu);
router.get("/orders", pagesController.orders);
router.get("/feedback", pagesController.feedback);
router.get("/admin", pagesController.admin);
router.get(/^\/(.+)\.html$/, pagesController.htmlRedirect);

module.exports = router;
