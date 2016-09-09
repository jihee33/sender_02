var express = require('express');
var router = express.Router();
var Reviews = require('../models/review');
var isAuthenticated = require('./common').isAuthenticated;
var getLog = require('./common').getLog;
var logger = require('../common/logger');

// No.18 리뷰 등록하기
router.post('/', getLog, isAuthenticated, function(req, res, next) {
    if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
        logger.log('debug', 'method: %s', req.method);
        logger.log('debug', 'protocol: %s', req.protocol);
        logger.log('debug', 'host: %s', req.headers['host']);
        logger.log('debug', 'originalUrl: %s', req.originalUrl);
        logger.log('debug', 'baseUrl: %s', req.baseUrl);
        logger.log('debug', 'url: %s', req.url);
        logger.log('debug', 'body: %j', req.body, {});
        logger.log('debug', 'range: %s', req.headers['range']);

        logger.log('info', '%s %s://%s%s', req.method, req.protocol, req.headers['host'], req.originalUrl);
        var reviewData = {};
        reviewData.userId = req.user.id;
        reviewData.contractId = req.body.contract_id;
        reviewData.content = req.body.content;
        reviewData.star = req.body.star;

        Reviews.insertReview(reviewData, function (err, result) {
            if (err) {
                return next(err);
            }
            res.send({
                result: result
            });
        });
    } else {
        res.send({
            error : '리뷰 등록에 실패했습니다.'
        });
    }
});// No.18 리뷰 등록하기

// No.19 리뷰 목록하기
router.get('/', getLog, isAuthenticated, function(req, res, next) {// 주문 목록 조회
    var currentPage = parseInt(req.query.currentPage);
    var itemsPerPage = parseInt(req.query.itemsPerPage);
    var delivererId = parseInt(req.query.deliverer_id);
    if (req.url.match(/\?currentPage=\d+&itemsPerPage=\d+&deliverer_id=\d+/i)) {
        Reviews.listReviews(currentPage, itemsPerPage, delivererId, function(err, result) {
            if (err) {
                return next(err);
            } else if (result !== 0) {
                res.send({
                    result: result
                });
            } else {
                res.send({
                    error : '리뷰 목록 불러오기를 실패했습니다.'
                });
            }
        });
    } else {
        res.send({
            error : '리뷰 목록 불러오기를 실패했습니다.'
        });
    }
}); // No.19 리뷰 목록하기

module.exports = router;