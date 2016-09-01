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
            data.arr_time, data.rec_phone, data.price, data.memo],
            function(err, result) {
                if (err) {return done(err);}
                affectedRows += result.affectedRows;
                ins_send_id = result.insertId;
                done(null);
            });
        } // 베송 요청 등록
        function insertFile(callback) {
            if (data.pic.length === 0) {
                dbConn.query(sql_insert_file, [ins_send_id, 1, '', ''], function (err, result) {
                    if (err) {return callback(err);}
                    affectedRows += result.affectedRows;
                    callback(null);
                });
            } else {
                async.each(data.pic, function (item, done) {
                    console.log('1');
                    dbConn.query(sql_insert_file, [ins_send_id, 1, item.name, item.path], function (err, result) {
                        if (err) {
                            return done(err);
                        }
                        affectedRows += result.affectedRows;
                        done(null);
                    });
                }, function (err) {
                    if (err) {
                        return callback(err);
                    }
                    callback(null);
                });
            }
        } // 배송 요청 파일 등록
    });
} // No.09

function selectSendingForDelivering(deliveringId, callback) {
    var sql_select_sending = 'select s.id sending_id, c.id contract_id, s.here_lat here_lat, s.here_lon here_lon, ' +
                                's.addr_lat addr_lat, s.here_lon here_lon, s.info info, ' +
                                'date_format(convert_tz(s.arr_time, ?, ?), \'%Y-%m-%d %H:%i:%s\') arr_time, ' +
                                's.rec_phone rec_phone, s.price price ' +
                                'from delivering d ' +
                                'join contract c on(d.contract_id = c.id) ' +
                                'join sending s on(c.id = s.contract_id) ' +
                                'where d.id = ? ';
    var sql_select_file = 'SELECT filename, filepath FROM file where type = ? and fk_id = ? ';
    var info = {};
    dbPool.getConnection(function(err, dbConn) {
                if (err) {return callback(err);}
                async.parallel([selectSending, selectFile], function(err, result) {
                    dbConn.release();
                    if (err) {callback(err);}
                    info.sending_id = result[0][0].sending_id;
                    info.contract_id =  result[0][0].contract_id;
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
                            fileUrl : url.resolve(url_, '/sending/' + filename)
                        });
                        callback();
                    });
                   callback(null, info);
                }); // async.parallel
    function selectSending(callback) {
        dbConn.query(sql_select_sending, ['+00:00', '+09:00', deliveringId], function(err, result) {
           if (err) {callback(err);}
           callback(null, result);
        });
    } //배송요청 출력
    function selectFile(callback) {
        dbConn.query(sql_select_file, [1, deliveringId], function(err, results) {
            if (err) {return callback(err);}
            callback(null, results);
        });
    } //배송요청 파일 출력
    }); //getConn
} // No.10

function listDelivering(currentPage, itemsPerPage, callback) {
    var sql_select_delivering_review_user ='SELECT d.id delivering_id, d.user_id user_id, u.name name, u.phone phone, ' +
                        'r.avg_star star, d.here_lat here_lat, d.here_lon here_lon, d.next_lat next_lat, d.next_lon next_lon, ' +
                            'date_format(convert_tz(d.dep_time, ?, ?), \'%Y-%m-%d %H:%i:%s\') dep_time, ' +
                            'date_format(convert_tz(d.arr_time, ?, ?), \'%Y-%m-%d %H:%i:%s\') arr_time, ' +
                            'f.filename filename, f.filepath filepath ' +
                            'from delivering d ' +
                            'join user u on(u.id = d.user_id) ' +
                            'left join (SELECT fk_id, filename, filepath, type from file WHERE type = 0) f on(u.id = f.fk_id) ' +
                            'left join ( ' +
                                'SELECT a.user_id user_id, AVG(star) avg_star FROM  delivering a ' +
                            'left JOIN review r ON (r.contract_id = a.contract_id))r on ( d.user_id = r.user_id) ' +
                            'group by d.id ' +
                            'order by d.id limit ?, ?';
    var sql_select_count = 'select count(id) count from delivering';
    var info = {};
    dbPool.getConnection(function(err, dbConn) {
        if (err) {return callback(err);}
        async.parallel([selectLimitDelivering, selectCountDelivering], function(err, result){
            if (err) return callback(err);
            info.totalPage = Math.ceil(result[1].count / itemsPerPage);
            info.currentPage = currentPage;
            info.itemsPerPage = itemsPerPage;
            info.data = [];
            async.each(result[0], function(item, callback) {
                if (err) {return callback(err);}
                info.data.push({
                    delivering_id : item.delivering_id,
                    user_id : item.user_id,
                    name : item.name,
                    phone : item.phone,
                    star : item.star,
                    here_lat : item.here_lat,
                    here_lon : item.here_lon,
                    next_lat : item.next_lat,
                    next_lon : item.next_lon,
                    dep_time : item.dep_time,
                    arr_time : item.arr_time,
                    originalFilename : item.filename,
                    fileUrl : url.resolve(url_, '/profiles/' + path.basename(item.filepath))
                });
                callback();
            });
            callback(null, info);
        }); // parallel

        function selectLimitDelivering(callback) {
            dbConn.query(sql_select_delivering_review_user,
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
        } // 배달 가기 카운트 출력_totalPage를 위해 존재
    });
} // No.11

function listIdDelivering(deliverId, callback) {
    var sql_select_delivering_id = 'select d.id deilvering_id, d.user_id, u.name, d.here_lat, d.here_lon, d.next_lat, d.next_lon, ' +
                                    'date_format(convert_tz(dep_time, ?, ?), \'%Y-%m-%d %H:%i:%s\') dep_time, ' +
                                    'date_format(convert_tz(arr_time, ?, ?), \'%Y-%m-%d %H:%i:%s\') arr_time ' +
                                    'from delivering d join user u on(u.id = d.user_id) where d.id = ? ';
    dbPool.getConnection(function(err, dbConn) {
        if (err) return callback(err);
        dbConn.query(sql_select_delivering_id, ['+00:00', '+09:00', '+00:00', '+09:00', deliverId], function(err, result) {
            dbConn.release();
            if (err) callback(err);
            callback(null, result);
        });
    });
} // No.12

function insertDelivering(obj, callback)  {
    var sql_insert_delivering = 'insert into delivering(user_id, here_lat, here_lon, next_lat, next_lon, dep_time, arr_time) ' +
                            'values(?, ?, ?, ?, ?, str_to_date(? ,\'%Y-%m-%d %H:%i:%s\'),str_to_date(? ,\'%Y-%m-%d %H:%i:%s\'))';
    dbPool.getConnection(function(err, dbConn) {
        if (err) return callback(err);
       dbConn.query(sql_insert_delivering, [obj.userId, obj.here_lat, obj.here_lon, obj.next_lat, obj.next_lon, obj.dep_time, obj.arr_time],
           function(err, result) {
               dbConn.release();
               var temp = {};
               temp.bool =  result.affectedRows;
               temp.delivering_id = result.insertId;
            if (err) return callback(err);
           callback(null, temp);
       });
    });
} // No.13

function updateContract1(contractId, callback) {
    var sql_update_contract = 'update contract ' +
                                'set state = ? ,res_time = str_to_date(now(), \'%Y-%m-%d %H:%i:%s\') ' +
                                ', utime = now()' +
                                'where id = ? ';
    dbPool.getConnection(function(err, dbConn) {
        if (err) { return callback(err); }
        dbConn.query(sql_update_contract, [contractId], function(err, result) {
            dbConn.release();
            if (err) {return callback(err);}
            callback(null, result.changedRows);
        });
    });
} // No.15_1

function updateContract9(contractId, callback) {
    var sql_update_contract = 'update delivering set contract_id = ? where contract_id = ? ';
    dbPool.getConnection(function(err, dbConn) {
        if (err) { return callback(err); }
        dbConn.query(sql_update_contract, [0, contractId], function(err, result) {
            dbConn.release();
            if (err) {return callback(err);}
            callback(null, result.changedRows);
        });
    });
} // No.15_9

function selectContract(contractId, callback) {
    var sql_select_contract = 'select c.id contract_id, s.id sender_id, d.id deliverer_id, ' +
                            'date_format(convert_tz(c.req_time, ?, ?), \'%Y-%m-%d %H:%i:%s\') req_time, ' +
                            'date_format(convert_tz(c.res_time, ?, ?), \'%Y-%m-%d %H:%i:%s\') res_time, c.state state ' +
                            'from contract c join sending s on(c.id = s.contract_id) ' +
                            'left join delivering d on(c.id = d.contract_id) ' + // LEFT JOIN을 통해 delivering이 없을 때도 내역 출력
                            'where c.id = ? ';
    dbPool.getConnection(function(err, dbConn) {
       if (err) {return callback(err);}
       dbConn.query(sql_select_contract, ['+00:00', '+09:00', '+00:00', '+09:00', contractId], function(err, results) {
           dbConn.release();
           if (err) {return callback(err);}
            callback(null, results[0]);
       });
    });
} // No.16

function plzContract(deliveringId, contractId, callback) {
    var sql_update_contract = 'update delivering set contract_id = ? where id = ? ';
    dbPool.getConnection(function(err, dbConn) {
        if (err) return callback(err);
        dbConn.query(sql_update_contract, [contractId, deliveringId], function(err, result) {
            dbConn.release();
            if (err) {return callback(err);}
            callback(null, result.changedRows);
        });
    });
} // No.14

module.exports.plzContract = plzContract;
module.exports.selectContract = selectContract;
module.exports.updateContract1 = updateContract1;
module.exports.updateContract9 = updateContract9;
module.exports.insertDelivering = insertDelivering;
module.exports.insertSendingContract = insertSendingContract;
module.exports.selectSendingForDelivering = selectSendingForDelivering;
module.exports.listDelivering = listDelivering;
module.exports.listIdDelivering = listIdDelivering;