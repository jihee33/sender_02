var express = require('express');
var router = express.Router();
var formidable = require('formidable');
var path = require('path');
var url = require('url');
var Contract = require('../models/contract');
var isSecure = require('./common').isSecure;
var isAuthenticated = require('./common').isAuthenticated;
//fixme : url_ 추후 변경
var url_ = 'http://ec2-52-78-70-38.ap-northeast-2.compute.amazonaws.com:8080';

router.post('/', isSecure, isAuthenticated, function(req, res, next) {
    var form = new formidable.IncomingForm();
    form.keepExtensions = true;
    form.multiples = true;
    form.uploadDir = path.join(__dirname, '../uploads/images/sendings');
    form.parse(req, function(err, fields, files) {
        if (err) {return next(err);}
        if (fields.here_lat && fields.here_lon && fields.addr_lat && fields.addr_lon && fields.rec_phone && fields.price) {
            var result = {};
            result.user_id = fields.user_id; //fixme : 추후 session값으로 변경
            result.here_lat = fields.here_lat;
            result.here_lon = fields.here_lon;
            result.addr_lat = fields.addr_lat;
            result.addr_lon = fields.addr_lon;
            result.arr_time = fields.arr_time;
            result.rec_phone = fields.rec_phone;
            result.price = fields.price;
            result.info = fields.info || "";
            result.memo = fields.memo || "";
            result.pic = [];
            if (files.pic instanceof Array) {
                result.pic = files.pic;
            } else if (files.pic) {
                result.pic.push(files.pic);
            }
            Contract.insertSendingContract(result, function (err, data) {
                if (err) {
                    return function() {
                    res.send({
                        error: '배송 요청 등록이 실패했습니다.'
                    });
                }
                }
                if (files.pic) {
                    var filename = path.basename(files.pic.path);
                    result.pic.push({url: url.resolve(url_, '/images/' + filename)});
                }
                if (data.affectedRows === 3) {
                    res.send({
                        result: {
                            sending_id : data.ins_send_id,
                            contract_id : data.ins_cont_id
                        }
                    });
                } else {
                    res.send({
                        error : '배송 요청 등록이 실패했습니다. 1'
                    });
                }
            });
        } else {
            res.send({
                  error : '배송 요청 등록이 실패했습니다.'
            });
        }
    });
}); // 9. 배송 요청 등록 및 미체결 계약 생성

router.get('/', isSecure, isAuthenticated, function(req, res, next) {
    if(req.url.match(/\/\?delivering_id=\d+/i)) {
        var delivering_id = req.query.delivering_id;
        Contract.selectSendingForDelivering(delivering_id, function(err, result) {
            if (err) return next(err);
            res.send({
                result : result
            });
        });
    } else {
        res.send({
            error : '배송 요청 보기에 실패했습니다'
        });
    }
}); // 10. 배송 요청 보기

router.get('/delivering', isSecure, isAuthenticated, function(req, res, next) {
    var currentPage = parseInt(req.query.currentPage);
    var itemsPerPage = parseInt(req.query.itemsPerPage);
    if (req.url.match(/\?currentPage=\d+&itemsPerPage=\d+/i)) {
        Contract.listDelivering(currentPage, itemsPerPage, function(err, result) {
            if (err) {
                return function() {
                    res.send({
                        error: '배달 가기의 목록을 불러올 수 없습니다.'
                    });
                }
            }
            res.send({
                result : result
            });
        });
    } else {
        res.send({
            error : '배달 가기의 목록을 불러올 수 없습니다.'
        });
    }
}); // 11. 배달 가기 목록 보기

router.get('/delivering/:delivering_id', isSecure, isAuthenticated, function(req, res, next) {
    var id = req.params.delivering_id;
    Contract.listIdDelivering(id, function(err, result) {
        if (err) return next(err);
        res.send({
            result : result
        });
    });

}); // 12. ‘배달가기’ 상세 목록 보기

router.post('/delivering', isSecure, isAuthenticated, function(req, res, next) {
    if (req.body.here_lat && req.body.here_lon && req.body.next_lat && req.body.next_lon && req.body.dep_time && req.body.arr_time) {
        var result = {};
        result.userId = req.body.user_id; //fixme : 추후 session값으로 변경
        result.here_lat = req.body.here_lat;
        result.here_lon = req.body.here_lon;
        result.next_lat = req.body.next_lat;
        result.next_lon = req.body.next_lon;
        result.dep_time = req.body.dep_time;
        result.arr_time = req.body.arr_time;
        Contract.insertDelivering(result, function(err, data) {
            if (err) {next(err);}
            if (data.bool === 1) {
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
            error : '배달 가기 정보 등록에 실패했습니다. (데이터 미등록)'
        });
    }
}); // 13. ‘배달 가기’ 등록

router.put('/delivering',isAuthenticated, function(req, res, next) {
    if (req.body.contract_id && req.body.delivering_id) {
        var contract_id = req.body.contract_id;
        var delivering_id = req.body.delivering_id;
        Contract.plzContract(delivering_id, contract_id, function(err, result) {
            if (err) return next(err);
            if (result === 1) {
                res.send({
                    result: '배송 요청에 성공했습니다.'
                });
            } else {
                res.send({
                    error : '배송 요청에 실패했습니다.'
                });
            }
        });
    } else {
        res.send({
            error : '배송 요청에 실패했습니다. 1'
        });
    }
}); // 14. 계약 신청하기

// isAuthenticated,
router.put('/', function(req, res, next) {
    if (req.body.contract_id && req.body.state) {
        var contract_id = req.body.contract_id;
        var state = req.body.state;
        if (state === '1') {
            Contract.updateContract1(contract_id, function (err, result) {
                if (result === 1) {
                    res.send({
                        result: '계약 체결을 수락했습니다. '
                    });
                } else {
                    res.send({
                        error: '계약 체결에 실패했습니다.'
                    });
                }
            });
        } else if (state === '9') {
            Contract.updateContract1(contract_id, function (err, result) {
                if (result === 1) {
                    res.send({
                        result: '계약 체결을 거절했습니다. '
                    });
                } else {
                    res.send({
                        error: '계약 체결에 실패했습니다.'
                    });
                }
            });
        }
    } else {
        res.send({
            error : '계약 체결에 실패했습니다.'
        });
    }
}); //  15. 계약 체결하기

router.get('/:contract_id', isAuthenticated, function(req, res, next) {
    if (req.params.contract_id) {
        var contract_id = req.params.contract_id;
        Contract.selectContract(contract_id, function(err, result) {
            if (err) {return next(err);}
            res.send({
                result : result
            });
        });
    } else {
        res.send({
             error : '계약 내역 보기를 실패했습니다.'
        });
    }
}); // 16. 계약 내역 보기

router.put('/:contract_id', isAuthenticated, function(req, res, next) {
    var contract_id = req.params.contract_id;
    var state = req.body.state;
    res.send({
        result : '계약 상태가 변경되었습니다.',
        temp : {
            contract_id : contract_id,
            state : state
        }
    });
}); // 17. 배송 상태 변경하기

module.exports = router;