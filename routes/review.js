var express = require('express');
var router = express.Router();
var Reviews = require('../models/review');
var isAuthenticated = require('./common').isAuthenticated;

router.get('/', isAuthenticated, function(req, res, next) {// 주문 목록 조회
        var currentPage = parseInt(req.query.currentPage);
        var itemsPerPage = parseInt(req.query.itemsPerPage);
        var delivererId = parseInt(req.query.deliverer_id);
        if (req.url.match(/\?currentPage=\d+&itemsPerPage=\d+&deliverer_id=\d+/i)) {
            Reviews.listReviews(currentPage, itemsPerPage, delivererId, function(err, result) {
                if (err) {
                    return next(err);
                }
                if (result !== null) {
                    res.send({
                        result: result
                    });
                } else {
                    res.send({
                        result: '등록된 리뷰가 없습니다'
                    });
                }
            });
        } else {
            res.send({
                error : '리뷰 목록 불러오기를 실패했습니다.'
            });
        }
       /* var currentPage = parseInt(req.query.currentPage, 10) || 1;
        var itemsPerPage = parseInt(req.query.itemsPerPage, 10) || 10;
        var delivererId = parseInt(req.query.deliverer_id, 10);

        res.send({
            totalPage : 10,
            currentPage : currentPage,
            itemsPerPage : itemsPerPage,//rowCount
            result : {
                user_id : delivererId,
                review : [{
                    reviewer_id : "Whizzard",
                    content : "물건을 너무 막 다루셔서 좌절감이 듭니다",
                    star : 3,
                    date : "2016-08-11 17:05:25"
                },
                {
                    reviewer_id : "Scovac",
                    content : "깨지기 쉬운 물건인데 너무 막 다루시네요",
                    star : 1,
                    date : "2016-08-13 17:05:25"
                },
                {
                    reviewer_id : "Armand",
                    content : "채팅을 너무 성의 없게 한다",
                    star : 4,
                    date : "2016-08-11 17:05:25"
                }]
            }
        });
    } else {
        res.send({
           message : '리뷰 목록 불러오기를 실패했습니다.'
        });
    }*/
});


module.exports = router;