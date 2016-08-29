var mysql = require('mysql');
var async = require('async');
var dbPool = require('./common').dbPool;
var path = require('path');
var url = require('url');
var fs = require('fs');
//fixme : 추후 변경
var url_ = 'http://localhost:8080';

function insertSendingContract(data, callback) {
    var sql_insert_contract = 'insert into contract(state) values(?)';
    var sql_insert_sending = 'INSERT INTO `senderdb`.`sending` (`user_id`, `contract_id`, `addr_lat`, `addr_lon`, `info`, `arr_time`, `rec_phone`, `price`) ' +
    'VALUES ( ?, ?, ?, ?, ?, str_to_date(?,\'%Y-%m-%d %H:%i:%s\'), ?, ?)';
    var sql_insert_file = 'insert into file(fk_id, type, filename, filepath) values(?, ?, ? ,?)';
    //  sql
    //  getconnection - trasaction
    //  async.series - func3개 1.insertSending 2.insertFile 3.insertContract
    dbPool.getConnection(function(err, dbConn) {
        var ins_cont_id = '';
        var ins_send_id = '';
        if (err) { return callback(err); }
        dbConn.beginTransaction(function (err) {
            if (err) {
                dbConn.release();
                return callback(err);
            }
            async.series([insertContract, insertSending, insertFile], function(err) {
                if (err) {return dbConn.rollback(function (){
                       dbConn.release();
                       callback(err);
                   });
                } // if
                dbConn.commit(function () {
                    dbConn.release();
                    callback(null, ins_send_id);
                });
            }); // async.series
        }); // transaction
        function insertContract(done) {
            dbConn.query(sql_insert_contract, [0], function(err, result) {
                if (err) {return done(err);}
                ins_cont_id = result.insertId;
                done(null);
            });
        } // 계약 등록
        function insertSending(done) {
            dbConn.query(sql_insert_sending, [data.user_id, ins_cont_id, data.addr_lat, data.addr_lon, data.info,
            data.arr_time, data.rec_phone, data.price, data.memo],
            function(err, result) {
                if (err) {return done(err);}
                ins_send_id = result.insertId;
                done(null);
            });
        } // 베송 요청 등록
        function insertFile(callback) {
            async.each(data.pic, function(item, done) {
                console.log(ins_send_id + " : "+ item.name  + " : "+ item.path);
            dbConn.query(sql_insert_file, [ins_send_id, 1, item.name, item.path], function(err, result) {
                if (err) { return done(err);}
                done(null);
            });
            }, function(err) {
                if (err) {return callback(err);}
                callback(null);
            });
        } // 배송 요청 파일 등록
    });
}

function selectSending(senderId, callback) {
    var sql_select_sending = 'SELECT id, addr_lat, addr_lon, info, date_format(convert_tz(arr_time, ?, ?), \'%Y-%m-%d %H:%i:%s\') arr_time, rec_phone, price, memo FROM sending where id = ? ';
    var sql_select_file = 'SELECT filename, filepath FROM file where type = ? and fk_id = ? ';
    var info = {};
    dbPool.getConnection(function(err, dbConn) {
                if (err) {return callback(err);}
                async.parallel([selectSending, selectFile], function(err, result) {
                    dbConn.release();
                    if (err) {callback(err);}
                    info.sender_id = senderId;
                    info.addr_lat = result[0][0].addr_lat;
                    info.addr_lon = result[0][0].addr_lon;
                    info.info = result[0][0].info;
                    info.arr_time = result[0][0].arr_time;
                    info.rec_phone = result[0][0].rec_phone;
                    info.price = result[0][0].price;
                    info.memo = result[0][0].memo;
                    info.pic = [];
                    async.each(result[1], function(item, callback) {
                       if (err) {return callback(err);}
                        var filename = path.basename(item.filepath);
                        info.pic.push({
                            originalFilename : item.filename,
                            fileUrl : url.resolve(url_ ,'/sending_images/'+filename)
                        });
                        callback();
                    });
                   callback(null, info);
                }); // async.parallel
    function selectSending(callback) {
        dbConn.query(sql_select_sending, ['+00:00', '+09:00', senderId], function(err, result) {
           if (err) {callback(err);}
           callback(null, result);
        });
    } //배송요청 출력
    function selectFile(callback) {
        dbConn.query(sql_select_file, [4, senderId], function(err, results) {
            if (err) {return callback(err);}
            callback(null, results);
        });
    } //배송요청 파일 출력
    }); //getConn
}

function listDelivering(currentPage, itemsPerPage, callback) {
    var sql_select_delivering = 'SELECT id deilver_id, user_id, here_lat, here_lon, next_lat, next_lon, ' +
                                'date_format(convert_tz(dep_time, ?, ?), \'%Y-%m-%d %H:%i:%s\') dep_time, ' +
                                'date_format(convert_tz(arr_time, ?, ?), \'%Y-%m-%d %H:%i:%s\') arr_time ' +
                                'FROM delivering order by id limit ?, ?';
    var sql_select_count = 'select count(id) count from delivering';
    var info = {};
    dbPool.getConnection(function(err, dbConn) {
        if (err) {return callback(err);}
        async.parallel([selectLimitDelivering, selectCountDelivering], function(err, result){
            dbConn.release();
            if (err) return callback(err);
            info.totalPage = Math.ceil(result[1].count / itemsPerPage);
            info.currentPage = currentPage;
            info.itemsPerPage = itemsPerPage;
            info.data = result[0];
            callback(null, info);

        });
        function selectLimitDelivering(callback) {
            dbConn.query(sql_select_delivering,
                ['+00:00', '+09:00', '+00:00', '+09:00' ,itemsPerPage * (currentPage - 1), itemsPerPage ],
                function(err, results) {
                    if (err) return callback(err);
                    if (results.length === 0) return callback(null, null);
                    callback(null, results);
                });
        } // 배달 페이지 출력
        function selectCountDelivering(callback) {
            dbConn.query(sql_select_count, [], function(err, result) {
                if (err) return callback(err);
                callback(null, result[0]);
            });
        } // 배달 가기 카운트 출력 _ totalPage를 위해 존재
    });
}

function listIdDelivering(deliverId, callback) {
    var sql_select_delivering_id = 'select id deilver_id, user_id, here_lat, here_lon, next_lat, next_lon, ' +
                                    'date_format(convert_tz(dep_time, ?, ?), \'%Y-%m-%d %H:%i:%s\') dep_time, ' +
                                    'date_format(convert_tz(arr_time, ?, ?), \'%Y-%m-%d %H:%i:%s\') arr_time ' +
                                    'from delivering where id = ? ';
    dbPool.getConnection(function(err, dbConn) {
        if (err) return callback(err);
        dbConn.query(sql_select_delivering_id, ['+00:00', '+09:00', '+00:00', '+09:00', deliverId], function(err, result) {
            dbConn.release();
            if (err) callback(err);
            callback(null, result);
        });
    });
}

function insertDelivering(obj, callback)  {
    var sql_insert_delivering = 'insert into delivering(user_id, here_lat, here_lon, next_lat, next_lon, dep_time, arr_time) ' +
                            'values(?, ?, ?, ?, ?, str_to_date(? ,\'%Y-%m-%d %H:%i:%s\'),str_to_date(? ,\'%Y-%m-%d %H:%i:%s\'))';
    dbPool.getConnection(function(err, dbConn) {
        if (err) return callback(err);
       dbConn.query(sql_insert_delivering, [obj.userId, obj.here_lat, obj.here_lon, obj.next_lat, obj.next_lon, obj.dep_time, obj.arr_time],
           function(err, result) {
           dbConn.release();
            if (err) return callback(err);
           callback(null, result.affectedRows);
       });
    });
}

module.exports.insertDelivering = insertDelivering;
module.exports.insertSendingContract = insertSendingContract;
module.exports.selectSending = selectSending;
module.exports.listDelivering = listDelivering;
module.exports.listIdDelivering = listIdDelivering;