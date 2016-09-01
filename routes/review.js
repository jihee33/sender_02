var express = require('express');
var router = express.Router();
var Reviews = require('../models/review');
var isAuthenticated = require('./common').isAuthenticated;

// No.18 리뷰 등록하기
router.post('/', isAuthenticated, function(req, res, next) {
    var reviewData = {};
    reviewData.userId = req.body.user_id;//fixme : 추후 session값으로 변경
    reviewData.contractId = req.body.contract_id;
    reviewData.content = req.body.content;
    reviewData.star = req.body.star;

    Reviews.insertReview(reviewData, function(err, result) {
       if (err) {
           return next(err);
       }
       res.send({
           result: result
       });
    });
});// No.18 리뷰 등록하기

// No.19 리뷰 목록하기
router.get('/', isAuthenticated, function(req, res, next) {// 주문 목록 조회
    var currentPage = parseInt(req.query.currentPage);
    var itemsPerPage = parseInt(req.query.itemsPerPage);
    var delivererId = parseInt(req.query.deliverer_id);
    if (req.url.match(/\?currentPage=\d+&itemsPerPage=\d+&deliverer_id=\d+/i)) {
        Reviews.listReviews(currentPage, itemsPerPage, delivererId, function(err, result) {
            if (err) {
                return next(err);
            }
            res.send({
                result: result
            });
        });
    } else {
        res.send({
            error : '리뷰 목록 불러오기를 실패했습니다.'
        });
    }
}); // No.19 리뷰 목록하기

module.exports = router;