var express = require('express');
var router = express.Router();
var formidable = require('formidable');
var path = require('path');
var url = require('url');
var fcm = require('node-gcm');
var Chatting = require('../models/chatting');

var isSecure = require('./common').isSecure;
var isAuthenticated = require('./common').isAuthenticated;
var isActivated = require('./common').isActivated;

var ecTo = 'http://ec2-52-78-70-38.ap-northeast-2.compute.amazonaws.com:8080';


router.post('/', isAuthenticated, isActivated, function(req, res, next) {
    if(req.url.match(/\/\?action=send/i)) {
        // TODO : No.21 채팅 메세지 전송하기
        var form = new formidable.IncomingForm();
         form.keepExtensions = true;
         form.multiples = true;
         form.uploadDir = path.join(__dirname, '../uploads/images/chattings');
         form.parse(req, function(err, fields, files) {
             if (err) {
                return next(err);
             }
             var data = {};
             data.receiverId = fields.receiver_id;
             data.message = fields.message;
             if (files.pic) {
                 data.pic = [];
                 data.pic.push(files.pic);
                 var filename = path.basename(files.pic.path);
                 data.pic.push({url: url.resolve(ecTo, '/chattings/' + filename)});
             }

             var tokens = [];
             var message = new fcm.Message({// 위에서 가져오거나 여기서 바로 만들거나
                 data: {
                     key1: 'values1',
                     key2: 'values2',
                 },
                 notification: {
                     title: '',
                     icon: '',
                     body: ''
                 }
             });
             var sender = new fcm.Sender('AIzaSyAdrYmCs6M-Oe4NjMlCKriXuGuWETODQCw');
             sender.send(message, {registration: tokens}, function (err, response) {
                 if (err) {
                     return next(err);
                 }
             });
             res.send({
                result : data
             });
         });



    }
    if(req.url.match(/\/\?action=notification/i)) {
        // TODO : No.23 배송 알림 전송하기
        var receiver_id = req.body.receiver_id;
        Chatting.getRegistrationToken(receiver_id, function(err, result) {
           if (err) {
               return next(err);
           }
            var tokens = [];
            var message = new fcm.Message({// 위에서 가져오거나 여기서 바로 만들거나
                data: {
                    key1: 'values1',
                    key2: 'values2',
                },
                notification: {
                    title: '',
                    icon: '',
                    body: ''
                }
            });
            var sender = new fcm.Sender(result);
            sender.send(message, {registration: tokens}, function (err, response) {
                if (err) {
                    return next(err);
                }
                res.send({
                    result : '배송 요청 전송을 성공하였습니다.',
                });
            });
        });

    }
    /*var form = new formidable.IncomingForm();
    form.keepExtensions = true;
    form.multiples = true;
    form.uploadDir = path.join(__dirname, '../uploads/images/menus');
    form.parse(req, function(err, fields, files) {
        if (err) { return next(err);}
        var data = {};
        data.receiverId = fields.receiver_id;
        data.name = fields.name;
        data.message = fields.message;

        if (files.pic) {
            data.pic = [];
            data.pic.push(files.pic);
            var filename = path.basename(files.pic.path);
            data.pic.push({url: url.resolve(ecTo, '/images/' + filename)});
        }
        res.send({
            result : data
        });
    });*/

});//  No.22 채팅 메세지 전송하기
router.get('/', isSecure, isAuthenticated, isActivated, function(req, res, next) {
    // TODO : No.22 채팅 메세지 수신하기
    if(req.url.match(/\/\?lastDate=*/i)) {

        return res.send({
            message : '채팅 메세지 수신하기',
            temp : req.query.lastDate
        })
    }
});

module.exports = router;
