var express = require('express');
var router = express.Router();
var formidable = require('formidable');
var path = require('path');
var url = require('url');
var Contract = require('../models/contract');
var isSecure = require('./common').isSecure;
var isAuthenticated = require('./common').isAuthenticated;
//fixme : ecTo 제거
var ecTo = 'http://ec2-52-78-70-38.ap-northeast-2.compute.amazonaws.com:80';

router.post('/', isSecure, isAuthenticated, function(req, res, next) {
    // body 값 받음 - 파일존재로 form-data
    // (1. 미체결 계약, 2.배송요청등록) 생성
    var form = new formidable.IncomingForm();
    form.keepExtensions = true;
    form.multiples = true;
    form.uploadDir = path.join(__dirname, '../uploads/images/sendings');
    form.parse(req, function(err, fields, files) {
        if (err) {return next(err);}
        var result = {};
        // Fixme : req.user.id
        result.user_id = fields.user_id; //fixme : 추후 session값으로 변경
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
        Contract.insertSendingContract(result, function(err, data) {
           if (err) { return next(err); }
           var filename = path.basename(files.pic.path);
           result.pic.push({url : url.resolve(ecTo,'/images/'+filename)});
           res.send({
               message : '배송 요청이 등록되었습니다.'
           });
        });
        });
}); // 8. 배송 요청 등록 및 미체결 계약 생성

router.get('/', isSecure, isAuthenticated,  function(req, res, next) {
    var sender = req.query.sender;
    if(req.url.match(/\/\?sender=\d+/i)) {
        Contract.selectSending(sender, function(err, result) {
            if (err) return next(err);
            res.send({
                result: result
            });
        });
    } else {
        res.send({
            error : '배송 요청 보기에 실패했습니다'
        });
    }
}); // 9. 배송 요청 보기

router.get('/delivering',isSecure, isAuthenticated, function(req, res, next) {
    var currentPage = parseInt(req.query.currentPage);
    var itemsPerPage = parseInt(req.query.itemsPerPage);
    var deliverer = {};
    if (req.url.match(/\?currentPage=\d+&itemsPerPage=\d+/i)) {
        Contract.listDelivering(currentPage, itemsPerPage, function(err, result) {
            if (err) return next(err);
            res.send({
                result : result
            });
        });
    } else {
        res.send({
            error : '배달 가기의 목록을 불러올 수 없습니다.'
        });
    }
}); // 10. 배달 가기 목록 보기

router.get('/delivering/:deliverer_id', isSecure, isAuthenticated, function(req, res, next) {
    var id = req.params.deliverer_id;
    Contract.listIdDelivering(id, function(err, result) {
        if (err) return next(err);
        res.send({
            result : result
        });
    });

}); // 11. ‘배달가기’ 상세 목록 보기

// fixme :  isSecure, isAuthenticated,
router.post('/delivering',function(req, res, next) {
    if (req.body.here_lat && req.body.here_lon && req.body.next_lat && req.body.next_lon && req.body.dep_time && req.body.arr_time) {
        var result = {};
        result.userId = req.body.user_id; //fixme : 추후 session값으로 변경
        result.here_lat = req.body.here_lat;
        result.here_lon = req.body.here_lon;
        result.next_lat = req.body.next_lat;
        result.next_lon = req.body.next_lon;
        result.dep_time = req.body.dep_time;
        result.arr_time = req.body.arr_time;
        Contract.insertDelivering(result, function(err, bool) {
            if (err) {next(err);}
            if (bool === 1) {
                res.send({
                    message : '배달 가기 정보를 등록했습니다.'
                });
            } else {
                res.send({
                    message : '배달 가기 정보 등록에 실패했습니다.'
                });
            }
        });
    } else {
        res.send({
            message : '배달 가기 정보 등록에 실패했습니다. (데이터 미등록)'
        });
    }
}); // 12. ‘배달 가기’ 등록

router.put('/', isAuthenticated, function(req, res, next) {
    var temp = {};
    temp.sender_id = req.body.sender_id;
    temp.deliverer_id = req.body.deliverer_id;
    temp.state = req.body.state;
    res.send({
        message : '계약이 체결 되었습니다.',
        temp : temp
    });
}); // 13. 계약 체결하기

router.get('/:contract_id', isSecure, isAuthenticated, function(req, res, next) {
    var contract_id = req.params.contract_id;
    res.send({
        result : {
            contract_id : contract_id,
            sender_id : 1,
            deliverer_id : 1,
            req_time : '2016-08-24 18:01:00',
            res_time : '2016-08-24 19:30:00',
            state : 2
        }
    });
}); // 14. 계약 내역 보기

router.put('/:contract_id', isAuthenticated, function(req, res, next) {
    var contract_id = req.params.contract_id;
    var state = req.body.state;
    res.send({
        message : '계약 상태가 변경되었습니다.',
        temp : {
            contract_id : contract_id,
            state : state
        }
    });
}); // 15. 배송 상태 변경하기

module.exports = router;