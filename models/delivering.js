var mysql = require('mysql');
var async = require('async');
var dbPool = require('./common').dbPool;
var path = require('path');
var url = require('url');
var fs = require('fs');
var logger = require('../common/logger');
var url_ = 'http://ec2-52-78-70-38.ap-northeast-2.compute.amazonaws.com:80';

// No.11 배달 가기 목록 보기
function listDelivering(currentPage, itemsPerPage, userId, callback) {
    var sql_select_delivering_review_user = 'select d.id delivering_id, d.user_id user_id, ' +
                                            'cast(aes_decrypt(u.name, unhex(sha2(? ,?))) as char(45)) name,' +
                                            'cast(aes_decrypt(u.phone, unhex(sha2(? ,?))) as char(45)) phone, ' +
                                            'r.avg_star star, d.here_lat here_lat, d.here_lon here_lon, d.next_lat next_lat, d.next_lon next_lon, ' +
                                            'date_format(convert_tz(d.dep_time, ?, ?), \'%Y-%m-%d %H:%i:%s\') dep_time, ' +
                                            'date_format(convert_tz(d.arr_time, ?, ?), \'%Y-%m-%d %H:%i:%s\') arr_time, ' +
                                            'f.filename filename, f.filepath filepath ' + //___column
                                            'from delivering d ' +
                                            'join user u on(u.id = d.user_id) ' +
                                            'left join contract c on(d.contract_id = c.id) ' +
                                            'left join (SELECT fk_id, filename, filepath, type from file WHERE type = 0) f on(u.id = f.fk_id) ' +
                                            'left join ( ' +
                                            'SELECT a.user_id user_id, AVG(star) avg_star ' +
                                            'FROM  delivering a ' +
                                            'left JOIN review r ON (r.contract_id = a.contract_id))r ' +
                                            'on ( d.user_id = r.user_id) ' +
                                            'where c.state is null AND d.user_id != ? ' +
                                            'group by d.id ' +
                                            'order by d.id limit ?, ?';
    // table -> delivering + user + file[type 0(user)인 table] + (delivering + review)[평균 별점을 위한 table]
    // col -> delivering_id, user_id, name, phone, star, here_lat, here_lon, next_lat, next_lon,
    //        dep_time, arr_time, filename, filepath
    var sql_select_count = 'select count(d.id) count from delivering d ' +
                            'left join contract c on(c.id = d.contract_id) ' +
                            'where c.state is null';

    async.parallel([selectLimitDelivering, selectCountDelivering], function(err, results){
        // selectLimitDelivering, selectCountDelivering을 동시에 실행
        if (err) {
            return callback(err);
        }
        var info = {};
        //result[1]은 selectCountDelivering 값
        if (results[1].count === 0) {
            callback(null, 0);
        } else {
            info.totalPage = Math.ceil(results[1].count / itemsPerPage); // 총 페이지를 itemsPerPage로 나눠 올림
            info.currentPage = currentPage; // 현재 페이지
            info.itemsPerPage = itemsPerPage; // rowCount
            info.data = [];

            async.each(results[0], function (item, as_done) { //  result[0]은 selectLimitDelivering 값
                if (err) {
                    return as_done(err);
                }
                if (item.filepath !== null) {
                    info.data.push({
                        delivering_id: item.delivering_id,
                        user_id: item.user_id, // 사용자 아이디
                        name: item.name, // 이름
                        phone: item.phone, //수신자 핸드폰 번호
                        star: item.star, // 평균 별점
                        here_lat: item.here_lat, // 현위치 위도
                        here_lon: item.here_lon, // 현위치 경도
                        next_lat: item.next_lat, // 행선지 위도
                        next_lon: item.next_lon, // 행선지 경도
                        dep_time: item.dep_time, // 출발 시각
                        arr_time: item.arr_time, // 도착 시각
                        originalFilename: item.filename, // 파일명
                        fileUrl: url.resolve(url_, '/profiles/' + path.basename(item.filepath)) // file url
                    });
                } else {
                    info.data.push({
                        delivering_id: item.delivering_id,
                        user_id: item.user_id, // 사용자 아이디
                        name: item.name, // 이름
                        phone: item.phone, //수신자 핸드폰 번호
                        star: item.star, // 평균 별점
                        here_lat: item.here_lat, // 현위치 위도
                        here_lon: item.here_lon, // 현위치 경도
                        next_lat: item.next_lat, // 행선지 위도
                        next_lon: item.next_lon, // 행선지 경도
                        dep_time: item.dep_time, // 출발 시각
                        arr_time: item.arr_time, // 도착 시각
                        originalFilename: null
                    });
                }
                as_done();
            }, function (err) {
                if (err) {
                    return callback(err);
                }
                callback(null, info);
            });
        }
    }); // parallel

    function selectLimitDelivering(done) {
        dbPool.getConnection(function(err, dbConn) {
            if (err) {
                return callback(err);
            }
            dbConn.query(sql_select_delivering_review_user,
                [process.env.MYSQL_SECRET, 512, process.env.MYSQL_SECRET, 512, '+00:00', '+09:00', '+00:00', '+09:00', userId, itemsPerPage * (currentPage - 1), itemsPerPage],
                function (err, results) {
                    dbConn.release();
                    if (err) {
                        return done(err);
                    }
                    if (results.length === 0) {
                        return done(null, null);
                    }
                    done(null, results);
                });
        });
    } // select_[delivering + user + file + review]_페이지 출력

    function selectCountDelivering(done) {
        dbPool.getConnection(function(err, dbConn) {
            if (err) {
                return callback(err);
            }
            dbConn.query(sql_select_count, [], function (err, result) {
                dbConn.release();
                if (err) {
                    return done(err);
                }
                done(null, result[0]);
            });
        });
    } // 배달 가기 카운트 출력_totalPage를 위해 존재
} // No.11 배달 가기 목록 보기

// No.12 ‘배달가기’ 상세 목록 보기
function listDeliveringById(deliverId, callback) {
    var sql_select_delivering_id =  'select d.id deilvering_id, d.user_id, ' +
        'cast(aes_decrypt(u.name, unhex(sha2(? ,?))) as char(45)) name, ' +
        'd.here_lat here_lat, d.here_lon here_lon, d.next_lat next_lat, d.next_lon next_lon, ' +
        'date_format(convert_tz(dep_time, ?, ?), \'%Y-%m-%d %H:%i:%s\') dep_time, ' +
        'date_format(convert_tz(arr_time, ?, ?), \'%Y-%m-%d %H:%i:%s\') arr_time ' +
        'from delivering d ' +
        'join user u on(u.id = d.user_id) ' +
        'where d.id = ? ';
    // table -> delivering + user
    // col -> delivering_id, user_id, name, here_lat, here_lon, next_lat, next_lon,dep_time, arr_time

    dbPool.getConnection(function(err, dbConn) {
        if (err) {
            return callback(err);
        }
        dbConn.query(sql_select_delivering_id, [process.env.MYSQL_SECRET, 512,'+00:00', '+09:00', '+00:00', '+09:00', deliverId], function(err, result) {
            dbConn.release();
            if (err) {
                callback(err);
            }
            if (result.length != 0) {
                callback(null, result);
            } else {
                callback(null, 0);
            }
        });
    });
} // No.12 ‘배달가기’ 상세 목록 보기

// No.13  ‘배달 가기’ 등록
function insertDelivering(obj, callback)  {
    var sql_insert_delivering = 'insert into delivering(user_id, here_lat, here_lon, next_lat, next_lon, dep_time, arr_time) ' +
                                'values(?, ?, ?, ?, ?, str_to_date(? ,\'%Y-%m-%d %H:%i:%s\'),str_to_date(? ,\'%Y-%m-%d %H:%i:%s\'))';
    // delivering테이블에 배달가기를 위한 정보를 입력
    dbPool.getConnection(function(err, dbConn) {
        if (err) {
            return callback(err);
        }
        dbConn.query(sql_insert_delivering, [obj.userId, obj.here_lat, obj.here_lon, obj.next_lat, obj.next_lon, obj.dep_time, obj.arr_time],
            function(err, result) {
                dbConn.release();
                if (err) {
                    return callback(err);
                }
                var data = {};
                data.exist =  result.affectedRows; // insert가 제대로 되었다면 OK -> 1
                data.delivering_id = result.insertId; // 입력된 delivering의 id
                callback(null, data);
            });
    });
} // No.13  ‘배달 가기’ 등록

module.exports.insertDelivering = insertDelivering;
module.exports.listDelivering = listDelivering;
module.exports.listDeliveringById = listDeliveringById;