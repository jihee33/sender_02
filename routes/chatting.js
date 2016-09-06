var express = require('express');
var router = express.Router();
var formidable = require('formidable');
var path = require('path');
var url = require('url');
var isSecure = require('./common').isSecure;
var isAuthenticated = require('./common').isAuthenticated;
var ecTo = 'http://ec2-52-78-70-38.ap-northeast-2.compute.amazonaws.com:80';


router.post('/', isAuthenticated, function(req, res, next) {
    if(req.url.match(/\/\?action=send/i)) {
        // TODO : No.21 채팅 메세지 전송하기
    }
    if(req.url.match(/\/\?action=getlog&lastDate=*/i)) {
        // TODO : No.22 채팅 메세지 수신하기
    }
    var form = new formidable.IncomingForm();
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
    });

});//  No.22 채팅 메세지 전송하기
router.get('/', isSecure, isAuthenticated, function(req, res, next) {
    // TODO : No.22 채팅 메세지 전송하기
});

module.exports = router;
