var express = require('express');
var router = express.Router();
var formidable = require('formidable');
var path = require('path');
var url = require('url');
var Delivering = require('../models/delivering');
var isSecure = require('./common').isSecure;
var isAuthenticated = require('./common').isAuthenticated;
var logger = require('../common/logger');
var url_ = 'http://ec2-52-78-70-38.ap-northeast-2.compute.amazonaws.com:80';

// 11. 배달 가기 목록 보기
router.get('/', isSecure, isAuthenticated, function(req, res, next) {
    if (req.url.match(/\?currentPage=\d+&itemsPerPage=\d+/i)) {
        var currentPage = parseInt(req.query.currentPage); // 현재 페이지
        var itemsPerPage = parseInt(req.query.itemsPerPage); // rowCount
        logger.log('info', '%s %s://%s%s', req.method, req.protocol, req.headers['host'], req.originalUrl);
        logger.log('debug', 'currentPage: %s', req.query.currentPage);
        logger.log('debug', 'itemsPerPage: %s', req.query.itemsPerPage);

        Delivering.listDelivering(currentPage, itemsPerPage, req.user.id, function(err, result) {
            if (err) {
                return next(err);
            }
            if (result !== 0) {
                res.send({
                    result : result
                });
            } else {
                res.send({
                    error : '배달 가기의 목록을 불러올 수 없습니다.'
                });
            }
        });
    } else {
        res.send({
            error : '배달 가기의 목록을 불러올 수 없습니다.'
        });
    }
}); // 11. 배달 가기 목록 보기

// 12. fixme : 안씀 _ 추후 사용시 쿼리 배달가기목록보기와 같이 수정해야 함 _ ‘배달가기’ 상세 목록 보기
router.get('/:delivering_id', isSecure, isAuthenticated, function(req, res, next) {
    if (req.params.delivering_id) {
        var id = parseInt(req.params.delivering_id);
        Delivering.listDeliveringById(id, function (err, result) {
            if (err) {
                return next(err);
            }
            if (result !== 0) {
                res.send({
                    result: result
                });
            } else {
                res.send({
                    error: '배달 가기의 목록을 불러올 수 없습니다.'
                });
            }
        });
    } else {
        res.send({
            error: '배달 가기의 목록을 불러올 수 없습니다.'
        });
    }
}); // 12. ‘배달가기’ 상세 목록 보기

// 13. ‘배달 가기’ 등록
router.post('/',  isSecure, isAuthenticated, function(req, res, next) {
    if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
        if (req.body.here_lat && req.body.here_lon && req.body.next_lat && req.body.next_lon && req.body.dep_time && req.body.arr_time) { // 필수 데이터
            var result = {};
            result.userId = req.user.id; // session값으로 변경
            result.here_lat = req.body.here_lat; // 현위치 위도
            result.here_lon = req.body.here_lon; // 현위치 경도
            result.here_unit = req.body.here_unit; // 현위치 동 이름
            result.next_lat = req.body.next_lat; // 행선지 위도
            result.next_lon = req.body.next_lon; // 행선지 경도
            result.next_unit = req.body.next_unit; // 행선지 동 이름
            result.dep_time = req.body.dep_time; // 출발 시각
            result.arr_time = req.body.arr_time; // 도착 시각
            Delivering.insertDelivering(result, function(err, data) {
                if (err) {
                    next(err);
                }
                if (data.exist === 1) { // 등록 된 값이 있다면 -> 1
                    res.send({
                        result : {
                            delivering_id : data.delivering_id
                        }
                    });
                } else {
                    res.send({
                        error : '배달 가기 정보 등록에 실패했습니다.'
                    });
                }
            });
        } else {
            res.send({
                error : '배달 가기 정보 등록에 실패했습니다.'
            });
        }
    } else {
        res.send({
            error: '배달 가기 정보 등록에 실패했습니다.'
        });
    }
}); // 13. ‘배달 가기’ 등록

module.exports = router;