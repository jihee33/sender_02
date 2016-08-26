var express = require('express');
var router = express.Router();
var formidable = require('formidable');
var path = require('path');
var url = require('url');
var Contract = require('../models/contract');
var isSecure = require('./common').isSecure;
var isAuthenticated = require('./common').isAuthenticated;
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
        result.user_id = fields.user_id;
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

router.get('/', isSecure, isAuthenticated, function(req, res, next) {
    var sender = req.query.sender;
    if(req.url.match(/\/\?sender=\d+/i)) {
        Contract.
        res.send({
            result: {
                sender_id: sender,
                addr : '서울 관악구 서울대 연구공원',
                info : '도자기',
                pic : ecTo+'/images/upload_01bd18c7dd4fa45013be85aef81111111.jpg',
                arr_time : '2016-08-24 11:24:32',
                req_phone : '010-1235-5555',
                price: 12000,
                memo: '깨지기 쉬워요!!'
            }
        });
    } else {
        res.send({
            error : '배송 요청 보기에 실패했습니다'
        });
    }
}); // 9. 배송 요청 보기

router.get('/delivering', isSecure, isAuthenticated, function(req, res, next) {
    var currentPage = parseInt(req.query.currentPage) || 1;
    var itemsPerPage = parseInt(req.query.itemsPerPage) || 10;
    if (req.url.match(/\?currentPage=\d+&itemsPerPage=\d+/i)) {
        res.send({
            totalPage : 10,
            currentPage : currentPage,
            itemsPerPage : itemsPerPage,
            result : {
                deliverer : [{
                    deliverer_id : 1,
                    user_id : 1,
                    here : '서울 서초구 강남대로 399 한국몬테소리 빌딩',
                    next : '서울 관악구 서울대 연구공원 웨딩홀 식당'
                },{
                    deliverer_id : 2,
                    user_id : 21,
                    here : '서울 서초구 서초대로 314 서브웨이',
                    next : '서울 관악구 남현1길 51 연안본가'
                },{
                    deliverer_id : 3,
                    user_id : 12,
                    here : '서울 서초구 강남대로61길 13 버터핑거팬케이크',
                    next : '서울 관악구 과천대로 947 사당타워 나동 1층 봉추찜닭'
                },{
                    deliverer_id : 4,
                    user_id :9,
                    here : '서울 관악구 남현1길 58 설악흑돼지마을',
                    next : '서울 관악구 서울대 연구공원 웨딩홀 식당'
                },{
                    deliverer_id : 5,
                    user_id : 5,
                    here : '서울 관악구 남현3길 78 만경양육관',
                    next : '서울 관악구 과천대로 947 사당타워 나동 1층 크리스피크림도넛'
                },{
                    deliverer_id : 6,
                    user_id : 41,
                    here : '서울 서초구 강남대로61길 13 버터핑거팬케이크',
                    next : '서울 관악구 서울대 연구공원 웨딩홀 식당'
                },{
                    deliverer_id : 7,
                    user_id : 88,
                    here : '서울 관악구 과천대로 939 르메이에르강남타운 3층 빕스',
                    next : '서울 관악구 과천대로 947 사당타워 나동 1층 크리스피크림도넛'
                },{
                    deliverer_id : 8,
                    user_id : 23,
                    here : '서울 관악구 과천대로 939 르메이에르강남타운 1층 피자헛',
                    next : '서울 관악구 서울대 연구공원 웨딩홀 식당'
                }]
            }
        });
    } else {
        res.send({
            error : '배달 가기의 목록을 불러올 수 없습니다.'
        });
    }
}); // 10. 배달 가기 목록 보기

router.get('/delivering/:deliverer_id', isSecure, isAuthenticated, function(req, res, next) {
    var id = req.params.deliverer_id;
    res.send({
        result : {
            deliverer : {
                user_id : 1,
                here : '서울 서초구 강남대로 399 한국몬테소리 빌딩',
                next : '서울 관악구 서울대 연구공원 웨딩홀 식당',
                dep_time : '2016-08-24 18:01:00',
                arr_time : '2016-08-24 19:30:00'
            }
        }
    });
}); // 11. ‘배달가기’ 상세 목록 보기

router.post('/delivering', isSecure, isAuthenticated, function(req, res, next) {
    var temp = {};
    temp.userId = req.body.user_id;
    temp.here = req.body.here;
    temp.next = req.body.next;
    temp.dep_time = req.body.dep_time;
    temp.arr_time = req.body.arr_time;
    res.send({
        message : '배달 가기 정보를 등록했습니다.',
        temp : temp
    });

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