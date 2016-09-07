var mysql = require('mysql');
var async = require('async');
var dbPool = require('./common').dbPool;
var path = require('path');
var url = require('url');
var fs = require('fs');
var url_ = 'http://ec2-52-78-70-38.ap-northeast-2.compute.amazonaws.com:8080'; //fixme : port 변경 -> 80

function selectNotice(currentPage, itemsPerPage, type, callback) {
    var sql_select_notice = 'select n.id notice_id, n.type type, n.title title, n.content content, f.filename originalFilename, f.filepath filepath, ' +
                            'date_format(convert_tz(n.write_time,?, ?), \'%Y-%m-%d %H:%i:%s\') write_time ' +
                            'from notice n join file f on (n.id = f.fk_id) ' +
                            'where f.type = ? and n.type = ? ' + // 4
                            'order by n.id ' +
                            'limit ?, ?';
    var sql_select_count = 'select count(id) count from notice where type = ? ';
    var info = {};
    async.parallel([selectNotice, selectCountOfNotice], function(err, results) {
        if (err) {
            return callback(err);
        }
        info.totalPage = Math.ceil(results[1].count / itemsPerPage);
        info.currentPage = currentPage;
        info.itemsPerPage = itemsPerPage;
        info.data = [];

        async.each(results[0], function(item, e_done) {
            var fileUrl = '';
            if (err) {
                return e_done(err);
            }
            if (item.filepath.length !== 0) {
                fileUrl = url.resolve(url_, '/notices_image/' + path.basename(item.filepath));
            }
            info.data.push({
                notice_id : item.notice_id,
                type : item.type,
                title : item.title,
                content : item.content,
                originalFilename : item.originalFilename,
                fileUrl: fileUrl, // file url
                write_date : item.write_time
            });
            e_done(null);
        }, function(err) {
            if (err) {
                return callback(err);
            }
            callback(null, info);
        });
    });

    function selectNotice(done) { // notice데이터를 얻어옴
        dbPool.getConnection(function(err, dbConn) {
            if (err) {
                return done(err);
            }
            dbConn.query(sql_select_notice, ['+00:00', '+09:00', 4, type, itemsPerPage * (currentPage - 1), itemsPerPage], function(err, results) {
                dbConn.release();
                if (err) {
                    return done(err);
                }
                done(null, results);
            });
        });
    }
    function selectCountOfNotice(done) { //totalPage를 위해 count를 얻음
        dbPool.getConnection(function(err, dbConn) {
            if (err) {
                return done(err);
            }
            dbConn.query(sql_select_count, [type], function(err, result) {
                dbConn.release();
                if (err) {
                    return done(err);
                }
                done(null, result[0]);
            });
        });
    }
}

module.exports.selectNotice = selectNotice;