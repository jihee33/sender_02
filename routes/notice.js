var express = require('express');
var router = express.Router();
var isAuthenticated = require('./common').isAuthenticated;
var Notice = require('../models/notice');
var logger = require('../common/logger');


router.get('/', isAuthenticated, function(req, res, next) {
    if (req.url.match(/\/\?currentPage=\d+&itemsPerPage=\d+/i)) {
        var currentPage = parseInt(req.query.currentPage);
        var itemsPerPage = parseInt(req.query.itemsPerPage);
        Notice.selectNotice(currentPage, itemsPerPage, function(err, results) {
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


