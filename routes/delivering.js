var express = require('express');
var router = express.Router();
var formidable = require('formidable');
var path = require('path');
var url = require('url');
var Delivering = require('../models/delivering');
var isSecure = require('./common').isSecure;
var isAuthenticated = require('./common').isAuthenticated;
var getLog = require('./common').getLog;
var logger = require('../common/logger');
var url_ = 'http://ec2-52-78-70-38.ap-northeast-2.compute.amazonaws.com:8080'; //fixme : port 변경 -> 80

// 11. 배달 가기 목록 보기
router.get('/', getLog, isSecure, isAuthenticated, function(req, res, next) {
    var currentPage = parseInt(req.query.currentPage); // 현재 페이지
    var itemsPerPage = parseInt(req.query.itemsPerPage); // rowCount
    if (req.url.match(/\?currentPage=\d+&itemsPerPage=\d+/i)) {
        Delivering.listDelivering(currentPage, itemsPerPage, function(err, result) {
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

// 12. ‘배달가기’ 상세 목록 보기
router.get('/:delivering_id', getLog, isSecure, isAuthenticated, function(req, res, next) {
    var id = parseInt(req.params.delivering_id);
    if (id !== undefined) {
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
router.post('/', getLog, isSecure, isAuthenticated, function(req, res, next) {
    if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
        if (req.body.here_lat && req.body.here_lon && req.body.next_lat && req.body.next_lon && req.body.dep_time && req.body.arr_time) { // 필수 데이터
            var result = {};
            result.userId = req.user.id; // session값으로 변경
            result.here_lat = req.body.here_lat; // 현위치 위도
            result.here_lon = req.body.here_lon; // 현위치 경도
            result.next_lat = req.body.next_lat; // 행선지 위도
            result.next_lon = req.body.next_lon; // 행선지 경도
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
                        error : '배달 가기 정보 등록에 실패했습니다. 1'
                    });
                }
            });
        } else {
            res.send({
                error : '배달 가기 정보 등록에 실패했습니다. 2'
            });
        }
    } else {
        res.send({
            error: '배달 가기 정보 등록에 실패했습니다. 3'
        });
    }
}); // 13. ‘배달 가기’ 등록

module.exports = router;