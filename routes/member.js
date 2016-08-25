var express = require('express');
var router = express.Router();
var formidable = require('formidable');
var path = require('path');
var async = require('async');
var url = require('url');
var isSecure = require('./common').isSecure;
var isAuthenticated = require('./common').isAuthenticated;
var ecTo = 'http://ec2-52-78-70-38.ap-northeast-2.compute.amazonaws.com:80';

router.put('/', isSecure, isAuthenticated, function(req, res, next) {
    var phone = req.body.phone;
    if (phone !== undefined) {
        res.send({
            message: phone + ': dummy 사용자 등록을 성공했습니다.'
        });
    } else {
        res.send({
            message: 'dummy 사용자 등록을 실패했습니다.'
        });
    }
}); // 2. 핸드폰 번호 등록

router.get('/me', isSecure, isAuthenticated, function(req, res, next) {
    res.send({
        result: {
            user_id : 1,
            name : '홍길동',
            email : 'hong123@hwalbin.com',
            phone : "010-1234-5678",
            introduction : '저는 안산에 살고 있습니다.', // 자기소개 내용
            deliver_com : 1, //배달 완료 횟수
            deliver_req : 5, // 배달 요청 횟수
            pic : ecTo + '/images/upload_20c413748c8b88ae38a10c03370cc850.jpg',
            activation : 1 // 활성화 유무
        }
    });
}); // 3. 자신의 정보 보기

router.get('/:user_id', isSecure, isAuthenticated, function(req, res, next) {
    var userId = req.params.user_id;
    res.send({
        result : {
            user_id: userId,
            name: '홍길동생',
            email: 'hongsang@hwalbin.com',
            phone: '010-1111-1111',
            introduction: '나는 홍길동의 동생입니다.',
            deliver_com: 3,
            deliver_req: 1,
            pic: ecTo + '/images/upload_01bd18c7dd4fa45013be85aef8ed10a5.jpg',
            activation: 1
        }
    });
}); // 4. 특정 사용자의 정보 보기

router.put('/me', isAuthenticated, function(req, res, next) {
    var form = new formidable.IncomingForm();
    form.keepExtensions = true;
    form.multiples = true;
    form.uploadDir = path.join(__dirname, '../uploads/images/menus');
    form.parse(req, function(err, fields, files) {
        if (err) {return next(err);}
        var menu = {};
        menu.files = [];
            menu.files.push(files.pic);
            var filename = path.basename(files.pic.path);
            menu.files.push({url : url.resolve(ecTo ,'/images/' + filename)});

            res.send({
                message: '프로필 사진의 변경을 성공하였습니다.',
                temp : menu
            });
    });
}); // 5. 자신의 프로필 사진 변경 하기

router.delete('/', isAuthenticated, function(req, res, next) {
    var userId = req.body.user_id;
    res.send({ message: userId +' : 회원 탈퇴가 처리되었습니다.' });
}); // 7. 회원 탈퇴 하기

module.exports = router;