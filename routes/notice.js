var express = require('express');
var router = express.Router();
var isAuthenticated = require('./common').isAuthenticated;

router.get('/', isAuthenticated, function(req, res, next) {
    var currentPage = parseInt(req.query.currentPage);
    var itemsPerPage = parseInt(req.query.itemsPerPage);
    var type = parseInt(req.query.type);
    if (req.url.match(/\/\?currentPage=\d+&itemsPerPage=\d+&type=\d+/i)) {
        if (type === 0) {
            res.send({
                totalpage : 10,
                correntPage : currentPage,
                itemsPerPage : itemsPerPage,
                result : [{
                    notice_id : 1,
                    type : 0,
                    title : '오픈!',
                    content : 'sender가 시작합니다!',
                    write_date : '2016-09-23 00:00:00'},{
                    notice_id : 2,
                    type : 0,
                    title : '두번째 공지 사항!',
                    content : 'sender가 업데이트 됩니다!',
                    write_date : '2016-10-23 00:00:00'}]
            });
        } else if (type === 1) {
            res.send({
                totalpage : 10,
                correntPage : currentPage,
                itemsPerPage : itemsPerPage,
                result : [{
                    notice_id : 3,
                    type : 1,
                    title : '오픈기녕 이벤트!',
                    content : '2주동안 배송비를 sender가 지원합니다!',
                    write_date : '2016-09-23 00:00:00'},{
                    notice_id : 4,
                    type : 1,
                    title : '업데이트 기념 이벤트!',
                    content : '업데이트 기념 배송비를 지원합니다!',
                    write_date : '2016-10-23 00:00:00'}]
            });
        } else {
            res.send({
               error : '공지 목록을 가져오지 못했습니다'
            });
        }
    }
});

module.exports = router;