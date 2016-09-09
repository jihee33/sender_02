var express = require('express');
var router = express.Router();
var formidable = require('formidable');
var path = require('path');
var url = require('url');
var fcm = require('node-gcm');
var Chatting = require('../models/chatting');

var getLog = require('./common').getLog;
var isSecure = require('./common').isSecure;
var isAuthenticated = require('./common').isAuthenticated;
var isActivated = require('./common').isActivated;

var ecTo = 'http://ec2-52-78-70-38.ap-northeast-2.compute.amazonaws.com:80';


router.post('/', getLog,  isAuthenticated, isActivated, function(req, res, next) {
    if(req.url.match(/\/\?action=send/i)) {
        // No.21 채팅 메세지 전송하기
        var form = new formidable.IncomingForm();
         form.keepExtensions = true;
         form.multiples = true;
         form.uploadDir = path.join(__dirname, '../uploads/images/chattings');
         form.parse(req, function(err, fields, files) {
             if (err) {
                 return next(err);
             }
             var data = {};
             data.senderId = req.user.id;
             data.receiverId = fields.receiver_id;
             if (fields.message) {
                 data.message = fields.message;
             }
             if (files.pic) {
                 data.pic = [];
                 data.pic.push(files.pic);
                 var filename = path.basename(files.pic.path);
                 data.pic.push({url: url.resolve(ecTo, '/chattings/' + filename)});
             }
             Chatting.getRegistrationToken(data.receiverId, function (err, result) {
                 if (err) {
                     return next(err);
                 }
                 var tokens = [];
                 tokens.push(result);
                 var message = new fcm.Message({// 위에서 가져오거나 여기서 바로 만들거나
                     data: {

                     },
                     notification: {
                         title: '채팅 메세지 전송',
                         icon: '',
                         body: '채팅 메세지 전송'
                     }
                 });
                 var sender = new fcm.Sender(result);
                 sender.send(message, {registration: tokens}, function (err, response) {
                     if (err) {
                         return next(err);
                     }
                     Chatting.insertChattingLog(data, function(err, result) {
                         if (err) {
                             return next(err);
                         }
                         res.send({
                             result: '전송 성공'
                         });
                     });
                 });
             });
         });
    }
    if(req.url.match(/\/\?action=notification/i)) {
        // No.23 배송 알림 전송하기
        var receiverId = req.body.receiver_id;
        Chatting.getRegistrationToken(receiverId, function(err, result) {
           if (err) {
               return next(err);
           }
            var tokens = [];
            tokens.push(result);
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
});

router.get('/', getLog, isSecure, isAuthenticated, isActivated, function(req, res, next) {
    // No.22 채팅 메세지 수신하기
    if(req.url.match(/\/\?senderId=\d+&contractId=\d+/i)) {
        var data = {};
        data.receiverId = req.user.id;
        data.senderId = req.query.senderId;
        data.contractId = req.query.contractId;
        Chatting.getChattingLogs(data, function(err, result) {
            if (err) {
                return next(err);
            }
            res.send({
                result : result
            });
        });
    }
});

module.exports = router;
