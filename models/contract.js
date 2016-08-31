var mysql = require('mysql');
var async = require('async');
var dbPool = require('./common').dbPool;
var path = require('path');
var url = require('url');
var fs = require('fs');
//fixme : 추후 변경
var url_ = 'http://ec2-52-78-70-38.ap-northeast-2.compute.amazonaws.com:8080';// dev_service용 url 설정

function insertSendingContract(data, callback) {
    var sql_insert_contract = 'insert into contract(state) values(?)';
    var sql_insert_sending = 'INSERT INTO sending (user_id, contract_id, here_lat, here_lon, addr_lat, addr_lon, info, arr_time, rec_phone, price, memo) ' +// memo 입력 누락으로 인한 memo 추가
    'VALUES ( ?, ?, ?, ?, ?, ?, ?, str_to_date(?,\'%Y-%m-%d %H:%i:%s\'), ?, ?, ?)';
    var sql_insert_file = 'insert into file(fk_id, type, filename, filepath) values(?, ?, ? ,?)';
    var affectedRows = 0;
    var ins_cont_id = '';
    var ins_send_id = '';
    //  sql
    //  getconnection - trasaction
    //  async.series - func3개 1.insertSending 2.insertFile 3.insertContract
    dbPool.getConnection(function(err, dbConn) {
        if (err) { return callback(err);}
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
                    var data = {};
                    data.affectedRows = affectedRows;
                    data.ins_cont_id = ins_cont_id;
                    data.ins_send_id = ins_send_id;
                    callback(null, data);
                });
            }); // async.series
        }); // transaction
        function insertContract(done) {
            dbConn.query(sql_insert_contract, [0], function(err, result) {
                if (err) {return done(err);}
                affectedRows += result.affectedRows;
                ins_cont_id = result.insertId;
                done(null);
            });
        } // 계약 등록
        function insertSending(done) {
            dbConn.query(sql_insert_sending, [data.user_id, ins_cont_id, data.here_lat, data.here_lon, data.addr_lat, data.addr_lon, data.info,
            data.arr_time, data.rec_phone, data.price, data.memo],// 메모 입력 누락이로 인한 data.memo 추가
            function(err, result) {
                if (err) {return done(err);}
                affectedRows += result.affectedRows;
                ins_send_id = result.insertId;
                done(null);
            });
        } // 베송 요청 등록
        function insertFile(callback) {
            async.each(data.pic, function(item, done) {
            dbConn.query(sql_insert_file, [ins_send_id, 1, item.name, item.path], function(err, result) {
                if (err) { return done(err);}
                affectedRows += result.affectedRows;
                done(null);
            });
            }, function(err) {
                if (err) {return callback(err);}
                callback(null);
            });
        } // 배송 요청 파일 등록
    });
}

function selectSending(sendingId, callback) {
    var sql_select_sending = 'SELECT id, here_lat, here_lon, addr_lat, addr_lon, info, date_format(convert_tz(arr_time, ?, ?), \'%Y-%m-%d %H:%i:%s\') arr_time, rec_phone, price, memo FROM sending where id = ? ';
    var sql_select_file = 'SELECT filename, filepath FROM file where type = ? and fk_id = ? ';
    var info = {};
    dbPool.getConnection(function(err, dbConn) {
                if (err) {return callback(err);}
                async.parallel([selectSending, selectFile], function(err, result) {
                    dbConn.release();
                    if (err) {callback(err);}
                    info.sending_id = sendingId;
                    info.here_lat = result[0][0].here_lat;
                    info.here_lon = result[0][0].here_lon;
                    info.addr_lat = result[0][0].addr_lat;
                    info.addr_lon = result[0][0].addr_lon;
                    info.info = result[0][0].info || "";
                    info.arr_time = result[0][0].arr_time;
                    info.rec_phone = result[0][0].rec_phone;
                    info.price = result[0][0].price;
                    info.memo = result[0][0].memo || "";
                    info.pic = [];
                    async.each(result[1], function(item, callback) {
                       if (err) {return callback(err);}
                        var filename = path.basename(item.filepath);
                        info.pic.push({
                            originalFilename : item.filename,
                            fileUrl : url.resolve(url_, '/sendings/' + filename)
                        });
                        callback();
                    });
                   callback(null, info);
                }); // async.parallel
    function selectSending(callback) {
        dbConn.query(sql_select_sending, ['+00:00', '+09:00', sendingId], function(err, result) {
           if (err) {callback(err);}
           callback(null, result);
        });
    } //배송요청 출력
    function selectFile(callback) {
        dbConn.query(sql_select_file, [1, sendingId], function(err, results) {
            if (err) {return callback(err);}
            callback(null, results);
        });
    } //배송요청 파일 출력
    }); //getConn
}

// TODO : 1.listDelivering 에서 지점시간 이후의 시간은 제외 할 수 있게
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

function updateContract(contractId, delivererId, callback) {
    var changedRows = 0;
    var sql_update_contract = 'update contract ' +
                                'set state = ? ,res_time = str_to_date(now(), \'%Y-%m-%d %H:%i:%s\') ' +
                                ', utime = str_to_date(now(), \'%Y-%m-%d %H:%i:%s\') ' +
                                'where id = ? ';
    var sql_update_delivering = 'update delivering set contract_id = ? where id = ?';
    dbPool.getConnection(function(err, dbConn) {
        if (err) { return callback(err); }
       dbConn.beginTransaction(function(err) {
           if (err) {
               dbConn.release();
               return callback(err);
           }
           async.parallel([updateContract, updateDelivering], function(err, result) {
               dbConn.release();
               if (err) {return dbConn.rollback(function (){
                   callback(err);
               });
               } // if
               dbConn.commit(function () {
                   callback(null, changedRows);
               });
           });
       });
        function updateContract(done) {
            dbConn.query(sql_update_contract, [1, contractId], function(err, result) {
               if (err) return done(err);
               changedRows += result.changedRows;
               done(null, null);
            });
        }
        function updateDelivering(done) {
            dbConn.query(sql_update_delivering, [contractId, delivererId], function(err, result) {
                if (err) return done(err);
                changedRows += result.changedRows;
                done(null, null);
            });
        }
    });
}

function selectContract(contractId, callback) {
    var sql_select_contract = 'select c.id contract_id, s.id sender_id, d.id deliverer_id, ' +
                            'date_format(convert_tz(c.req_time, ?, ?), \'%Y-%m-%d %H:%i:%s\') req_time, ' +
                            'date_format(convert_tz(c.res_time, ?, ?), \'%Y-%m-%d %H:%i:%s\') res_time, c.state state ' +
                            'from contract c join sending s on(c.id = s.contract_id) ' +
                            'left join delivering d on(c.id = d.contract_id) ' + // LEFT JOIN을 통해 delivering이 없을 때도 내역 출력
                            'where c.id = ? ';
    dbPool.getConnection(function(err, dbConn) {
       if (err) {
           return callback(err);
       }
       dbConn.query(sql_select_contract, ['+00:00', '+09:00', '+00:00', '+09:00', contractId], function(err, results) {
           dbConn.release();
           if (err) {
               return callback(err);
           }
           console.log(results[0]);
            callback(null, results[0]);
       });
    });
}

module.exports.selectContract = selectContract;
module.exports.updateContract = updateContract;
module.exports.insertDelivering = insertDelivering;
module.exports.insertSendingContract = insertSendingContract;
module.exports.selectSending = selectSending;
module.exports.listDelivering = listDelivering;
module.exports.listIdDelivering = listIdDelivering;