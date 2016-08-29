var express = require('express');
var router = express.Router();
var formidable = require('formidable');
var path = require('path');
var async = require('async');
var url = require('url');
var isSecure = require('./common').isSecure;
var isAuthenticated = require('./common').isAuthenticated;

var Member = require('../models/member');

var ecTo = 'http://ec2-52-78-70-38.ap-northeast-2.compute.amazonaws.com:80';

router.put('/', isSecure, isAuthenticated, function(req, res, next) {
    var user = {};
    user.phone = req.body.phone;
    if (user.phone !== undefined) {
        user.id = req.user.id;
        Member.updateMember(user, function (err) {
            if (err) {
                return function() {
                    res.send({
                        error: '사용자 등록을 실패했습니다.'
                    });
                    next(err);
                }
            }
            res.send({
               result: '사용자 등록을 성공했습니다.'
            });
        });
    } else {
        next(new Error('사용자 등록을 실패했습니다.'));
    }
}); // 2. 핸드폰 번호 등록

router.get('/me', isSecure, isAuthenticated, function(req, res, next) {
    Member.findUser(req.user.id, function (err, user) {
        if (err) {
            return function () {
                res.send({
                    error: '자신의 프로필을 불러오는데 실패했습니다.'
                })
            }
        }
        if (user.activation !== 0) {
            res.send({
                result: user
            });
        } else {
            res.send({
                error: '핸드폰 번호 등록을 통해 계정을 활성화 시켜야 합니다'
            })
        }
    });
}); // 3. 자신의 정보 보기

router.get('/:user_id', isSecure, isAuthenticated, function(req, res, next) {
    var userId = req.params.user_id;
    Member.findUser(userId, function (err, user) {
        if (err) {
            return function() {
                res.send({
                    error: '특정 사용자의 프로필을 불러오는데 실패했습니다.'
                })
            }
        }
        if (user.activation !== 0) {
            res.send({
                result: user
            });
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
                result: '프로필 사진의 변경을 성공하였습니다.',
                temp : menu
            });
    });
}); // 5. 자신의 프로필 사진 변경 하기

router.delete('/', isAuthenticated, function(req, res, next) {
    var userId = req.user.id;
    res.send({ result: userId +' : 회원 탈퇴가 처리되었습니다.' });
}); // 7. 회원 탈퇴 하기

module.exports = router;