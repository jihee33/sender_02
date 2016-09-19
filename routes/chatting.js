var express = require('express');
var router = express.Router();
var formidable = require('formidable');
var path = require('path');
var url = require('url');
var fcm = require('node-gcm');
var Chatting = require('../models/chatting');

var logger = require('../common/logger');
var isSecure = require('./common').isSecure;
var isAuthenticated = require('./common').isAuthenticated;
var isActivated = require('./common').isActivated;

var url_ = 'http://ec2-52-78-70-38.ap-northeast-2.compute.amazonaws.com:80';

router.post('/', isAuthenticated, isActivated, function(req, res, next) {
    logger.log('info', '%s %s://%s%s', req.method, req.protocol, req.headers['host'], req.originalUrl);
    if(req.url.match(/\/\?action=send/i)) { // No.21 채팅 메세지 전송하기
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
             data.contractId = fields.contract_id;
             data.receiverId = fields.receiver_id;
             if (fields.message) {
                 data.message = fields.message;
             }
             if (files.pic) {
                 data.pic = [];
                 data.pic.push(files.pic);
                 var filename = path.basename(files.pic.path);
                 data.pic.push({url: url.resolve(url_, '/chattings/' + filename)});
             }
             Chatting.insertChattingLog(data, function(err) {
                 if (err) {
                     return next(err);
                 }
                 Chatting.getRegistrationToken(data.receiverId, function (err, result) {
                     if (err) {
                         return next(err);
                     }
                     logger.log('debug', 'registrationToken : %s', result);
                     logger.log('debug', 'reg_token : %j', result, {});
                     var tokens = [];
                     tokens.push(result.registration_token);
                     logger.log('debug', 'tokens : %j', tokens, {});
                     var message = new fcm.Message({// 위에서 가져오거나 여기서 바로 만들거나
                         data: {
                             type : 'chat',
                             sender_id : data.senderId,
                             contract_id : data.contractId
                         }
                     });
                     logger.log('debug', 'fcm message : ', message);
                     var sender = new fcm.Sender(process.env.GCM_KEY);
                     setTimeout(function(){
                         sender.send(message, {registrationTokens: tokens}, function (err, response) {
                             if (err) {
                                 return next(err);
                             }
                             logger.log('debug', 'response : %j', response, {});
                             if (response.failure !== 1) {
                                 res.send({
                                     result: '전송 성공'
                                 });
                             } else {
                                 res.send({
                                     error: '채팅 메세지 전송을 실패하였습니다.'
                                 });
                             }
                         });
                     }, 1000);
                 });
             });
         });
    }
    /*if(req.url.match(/\/\?action=notification/i)) { // No.23 배송 알림 전송하기
        var receiverId = parseInt(req.body.receiver_id);
        logger.log('debug', 'receiverId : %s', receiverId);
        Chatting.getRegistrationToken(receiverId, function(err, result) {
           if (err) {
               return next(err);
           }
            var tokens = [];
            logger.log('debug', 'reg_token : %j', result, {});
            tokens.push(result.registration_token);
            logger.log('debug', 'tokens : %j', tokens, {});
            var message = new fcm.Message({ // 위에서 가져오거나 여기서 바로 만들거나
                data: {
                    type : 'delivery'
                }
            });
            logger.log('debug', 'fcm message : ', message);
            var sender = new fcm.Sender(process.env.GCM_KEY);
            sender.send(message, {registrationTokens: tokens}, function (err, response) {
                if (err) {
                    return next(err);
                }
                logger.log('debug', 'response : %j', response, {});
                if (response.failure !== 1) {
                    res.send({
                        result: '배송 요청 전송을 성공하였습니다.'
                    });
                } else {
                    res.send({
                        error: '배송 요청 전송을 실패하였습니다.'
                    });
                }
            });
        });
    }*/
});

router.get('/', isSecure, isAuthenticated, isActivated, function(req, res, next) {
    logger.log('info', '%s %s://%s%s', req.method, req.protocol, req.headers['host'], req.originalUrl);
    // No.22 채팅 메세지 수신하기
    logger.log('debug', 'query : %j', req.query, {});
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
