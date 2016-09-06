var express = require('express');
var router = express.Router();
var formidable = require('formidable');
var path = require('path');
var url = require('url');
var Contract = require('../models/contract');
var isSecure = require('./common').isSecure;
var isAuthenticated = require('./common').isAuthenticated;
var url_ = 'http://ec2-52-78-70-38.ap-northeast-2.compute.amazonaws.com:8080'; //fixme : port 변경 -> 80

// 9. 배송 요청 등록 및 미체결 계약 생성
router.post('/', isSecure, isAuthenticated, function(req, res, next) {
    if (req.headers['content-type'] !== 'application/x-www-form-urlencoded') { //form-data 형식
        var form = new formidable.IncomingForm();
        form.keepExtensions = true;
        form.multiples = true;

        form.parse(req, function (err, fields, files) {
            if (err) {
                return next(err);
            }

            if (fields.here_lat && fields.here_lon && fields.addr_lat && fields.addr_lon && fields.rec_phone && fields.price) { //필수 데이터
                var result = {};
                result.user_id = parseInt(fields.user_id); //fixme : session값으로 변경 -> req.user
                result.here_lat = fields.here_lat; // 현위치 위도
                result.here_lon = fields.here_lon; // 현위치 경도
                result.addr_lat = fields.addr_lat; // 목적지 위도
                result.addr_lon = fields.addr_lon; // 목적지 경도
                result.arr_time = fields.arr_time; // 도착 시각
                result.rec_phone = fields.rec_phone; // 수신자 전화번호
                result.price = parseInt(fields.price); // 배송비
                result.info = fields.info || ""; // 정보
                result.memo = fields.memo || ""; //메모
                result.pic = [];

                if (files.pic instanceof Array) { // 다수의 사진
                    result.pic = files.pic;
                } else if (files.pic) { // 1장의 사진
                    result.pic.push(files.pic);
                } else {
                    result.pic.push({name : '', path : ''});
                }

                Contract.insertSendingAndContract(result, function (err, data) {
                    if (err) {
                        return next(err);
                    }

                    if (files.pic) { // 사진이 없을 경우를 보완
                        var filename = path.basename(files.pic.path);
                        result.pic.push({url: url.resolve(url_, '/images/' + filename)});
                        form.uploadDir = path.join(__dirname, '../uploads/images/sendings'); //파일 업로드
                    }

                    if (data.affectedRows === 3) { //insert가 제대로 된 경우
                        res.send({
                            result: {
                                sending_id: data.sending_id, // 생성된 sending table의 id
                                contract_id: data.contract_id // 생성된 contract table의 id
                            }
                        });
                    } else {
                        res.send({
                            error: '배송 요청 등록이 실패했습니다. 1' // fixme : 숫자 제거
                        });
                    }
                });
            } else {
                res.send({
                    error: '배송 요청 등록이 실패했습니다. 2'
                });
            }
        });
    } else {
        res.send({
            error: '배송 요청 등록이 실패했습니다. 3'
        });
    }
}); // 9. 배송 요청 등록 및 미체결 계약 생성

// 10. 배송 요청 보기
router.get('/', isSecure, isAuthenticated, function(req, res, next) {
    if(req.url.match(/\/\?delivering_id=\d+/i)) {
        var delivering_id = parseInt(req.query.delivering_id);
        Contract.selectSending(delivering_id, function(err, result) {
            if (err) {
                return next(err);
            }
            if (result !== 0) {
                res.send({
                    result: result
                });
            } else {
                res.send({
                    error : '배송 요청 보기에 실패했습니다'
                });
            }
        });
    } else {
        res.send({
            error : '배송 요청 보기에 실패했습니다'
        });
    }
}); // 10. 배송 요청 보기

//  14. 계약 신청 및 체결하기
router.put('/', function(req, res, next) {
    if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
        var contract_id = parseInt(req.body.contract_id);
        if (req.body.contract_id && req.body.state) {
            var state = parseInt(req.body.state);
            if (state === 1) { // 수락;
                Contract.acceptContract(contract_id, function (err, results) {
                    if (err) {
                        return next(err);
                    }
                    if (results.changedRows === 1) { // 업데이트 완료시 -> 1
                        delete results.changedRows;
                        res.send({
                            result: results
                        });
                    } else {
                        res.send({
                            error: '계약 체결에 실패했습니다. 1-1'
                        });
                    }
                });
            } else if (state === 9) { // 거절
                Contract.rejectContract(contract_id, function (err, result) {
                    if (err) {
                        return next(err);
                    }
                    if (result === 1) { // 업데이트 완료시 -> 1
                        res.send({
                            result: '계약 체결을 거절했습니다. '
                        });
                    } else {
                        res.send({
                            error: '계약 체결에 실패했습니다. 1-2'
                        });
                    }
                });
            } // elseif _9_
        }else if (req.body.contract_id && req.body.delivering_id) {
            var delivering_id = parseInt(req.body.delivering_id);
            Contract.requestContract(delivering_id, contract_id, function(err, result) {
                if (err) {
                    return next(err);
                }
                if (result === 1) { // 업데이트 된 값이 있다면 -> 1
                    res.send({
                        result: '계약 체결에 성공했습니다.'
                    });
                } else {
                    res.send({
                        error : '계약 체결에 실패했습니다. 1'
                    });
                }
            });
        } else {
            res.send({
                error : '실패했습니다. 2'
            });
        }
    } else {
        res.send({
            error: '실패했습니다. 3'
        });
    }
}); // 14. 계약 신청 및 체결하기

// 15. 계약 내역 보기
router.get('/:contract_id', isAuthenticated, function(req, res, next) {
    if (req.params.contract_id) {
        var contract_id = req.params.contract_id;
        Contract.selectContract(contract_id, function(err, result) {
            if (err) {
                return next(err);
            }
            res.send({
                result : result
            });
        });
    } else {
        res.send({
             error : '계약 내역 보기를 실패했습니다.'
        });
    }
}); // 15. 계약 내역 보기

// TODO : 16. 배송 상태 변경하기 // isAuthenticated,
router.put('/:contract_id', function(req, res, next) {
    if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
        var contractId = parseInt(req.params.contract_id);
        var state = parseInt(req.body.state);
        Contract.changeStateOfContract(contractId, state, function(err, result) {
            if (err) {
                return next(err);
            }

        });
        res.send({
            result : '계약 상태가 변경되었습니다.',
            temp : {
                contract_id : contract_id,
                state : state
            }
        });
    } else {
        res.send({
            error: '계약 체결상태 변경을 실패했습니다. 3'
        });
    }
}); // 16. 배송 상태 변경하기

module.exports = router;