var express = require('express');
var router = express.Router();
var formidable = require('formidable');
var path = require('path');
var url = require('url');
var Board = require('../models/board');
var isSecure = require('./common').isSecure;
var isAuthenticated = require('./common').isAuthenticated;
var logger = require('../common/logger');
var ecTo = 'http://ec2-52-78-70-38.ap-northeast-2.compute.amazonaws.com:80'; //Fixme

//  No.20 게시글 등록하기
router.post('/', isSecure, isAuthenticated, function(req, res, next) {
    if (req.headers['content-type'] !== 'application/x-www-form-urlencoded') { //form-data 형식
        var form = new formidable.IncomingForm();
        form.keepExtensions = true;
        form.multiples = true;
        form.uploadDir = path.join(__dirname, '../uploads/images/boards');
        form.parse(req, function (err, fields, files) {
            if (err) {
                return next(err);
            }
            logger.log('info', '%s %s://%s%s', req.method, req.protocol, req.headers['host'], req.originalUrl);
            logger.log('debug', 'fields: %j', fields, {});
            logger.log('debug', 'files: %j', files, {});

            var data = {};
            var boardType = parseInt(fields.boardType);
            data.user_id = req.user.id;
            data.boardType = boardType;
            data.name = fields.name || '';
            data.title = fields.title || '';
            data.content = fields.content;
            data.esType = fields.esType;
            data.pic = [];

            if (files.pic instanceof Array) { // 사진 여러장
                data.pic = files.pic;
            } else if (files.pic) { // 사진 1장
                data.pic.push(files.pic);
            } else { // 사진 없음
                data.pic.push({name : '', path : ''});
            }

            Board.insertBoard(data, function(err, result) {
               if (err) {
                   return next(err);
               }
               if (result >= 1) {
                    if (files.pic) { // 파일 없을 경우 필터링
                       var filename = path.basename(files.pic.path);
                       data.pic.push({url: url.resolve(ecTo, '/boards/' + filename)});
                    }
                    if (boardType === 0) { // 칭찬
                        res.send({
                            message: '칭찬이 등록되었습니다.'
                        });
                    } else if (boardType === 1) { // 신고
                        res.send({
                            message: '신고가 등록되었습니다.'
                        });
                    } else if (boardType === 2) { // 문의
                        res.send({
                            message : '문의가 등록되었습니다.'
                        })
                    } else {
                        res.send({
                            error: '칭찬/신고/문의 등록을 실패했습니다. 1'
                        });
                    }
                } else {
                    res.send({
                        error: '칭찬/신고/문의 등록을 실패했습니다. 2'
                    });
                }
            });
        });
    }
}); // No.20 게시글 등록하기

module.exports = router;