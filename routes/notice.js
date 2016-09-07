var express = require('express');
var router = express.Router();
var isAuthenticated = require('./common').isAuthenticated;
var getLog = require('./common').getLog;
var Notice = require('../models/notice');
var logger = require('../common/logger');

// TODO :  이벤트, 공지사항
router.get('/', getLog, isAuthenticated, function(req, res, next) {
    if (req.url.match(/\/\?currentPage=\d+&itemsPerPage=\d+&type=\d+/i)) {
        var currentPage = parseInt(req.query.currentPage);
        var itemsPerPage = parseInt(req.query.itemsPerPage);
        var type = parseInt(req.query.type);
        Notice.selectNotice(currentPage, itemsPerPage, type, function(err, results) {
            if (err) {
                return next(err);
            }
            res.send({
                result : results
            });
        });
    }
}); // 이벤트, 공지사항

module.exports = router;