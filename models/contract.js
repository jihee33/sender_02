var mysql = require('mysql');
var async = require('async');
var dbPool = require('./common').dbPool;
var path = require('path');
var url = require('url');
var fs = require('fs');
var logger = require('../common/logger');
var url_ = 'http://ec2-52-78-70-38.ap-northeast-2.compute.amazonaws.com:80';

function getRegistrationToken(data, callback) {
    var sql_select_registration_token = 'SELECT registration_token FROM user WHERE id = ?';
    dbPool.getConnection(function(err, dbConn) {
        if (err) {
            return callback(err);
        }
        dbConn.query(sql_select_registration_token, [data], function(err, results) {
            dbConn.release();
            if (err) {
                return callback(err);
            }
            callback(null, results[0]);
        });
    });
}

// No.09 배송 요청 등록 및 미체결 계약 생성
function insertSendingAndContract(data, callback) {
    var sql_insert_contract = 'insert into contract(state) values(?)';
    var sql_insert_sending = 'insert into sending (user_id, contract_id, here_lat, here_lon, addr_lat, addr_lon, info, arr_time, rec_phone, price, memo) ' +
                             'VALUES ( ?, ?, ?, ?, ?, ?, ?, str_to_date(?,\'%Y-%m-%d %H:%i:%s\'), aes_encrypt(? ,unhex(sha2( ? , ?))), ?, ?)';
    var sql_insert_file = 'insert into file(fk_id, type, filename, filepath) values(?, ?, ? ,?)';

    dbPool.getConnection(function(err, dbConn) {
        if (err) {
            return callback(err);
        }
        var affectedRows = 0;
        var contract_id = '';
        var sending_id = '';
        dbConn.beginTransaction(function (err) {
            if (err) {
                dbConn.release();
                return callback(err);
            }
            async.series([insertContract, insertSending, insertFile], function(err) {
                dbConn.release();
                if (err) {
                    return dbConn.rollback(function (){
                       callback(err);
                   });
                }
                dbConn.commit(function () {
                    var data = {};
                    data.affectedRows = affectedRows; // OK -> 3 올바르게 진행된 insert문의 개수
                    data.contract_id = contract_id; // contract의 id
                    data.sending_id = sending_id; // sending의 id
                    callback(null, data);
                });
            }); // async.series
        }); // transaction
        function insertContract(done) { // constract 생성_계약 등록
            dbConn.query(sql_insert_contract, [0], function(err, result) { //미체결 계약 생성이라 state = 0
                if (err) {
                    return done(err);
                }
                affectedRows += result.affectedRows; // OK -> 1
                contract_id = result.insertId; // 새로 생긴 constract의 id 삽입
                done(null);
            });
        }

        function insertSending(done) { // sending 생성_베송 요청 등록
            dbConn.query(sql_insert_sending, [data.user_id, contract_id, data.here_lat, data.here_lon, data.addr_lat, data.addr_lon, data.info,
            data.arr_time, data.rec_phone, process.env.MYSQL_SECRET, 512, data.price, data.memo],
            function(err, result) {
                if (err) {
                    return done(err);
                }
                affectedRows += result.affectedRows; // OK -> 2
                sending_id = result.insertId; // 새로 생긴 sending의 id 삽입
                done(null);
            });
        }

        function insertFile(done) { // file 생성_배송 요청 파일 등록
                async.each(data.pic, function (item, as_done) {
                    dbConn.query(sql_insert_file, [sending_id, 1, item.name, item.path], function (err, result) { // file type -> sending은 1 [DB]
                        if (err) {
                            return as_done(err);
                        }
                        affectedRows += result.affectedRows; // OK -> 3
                        as_done(null);
                    });
                }, function (err) {
                    if (err) {
                        return done(err);
                    }
                    done(null);
                });
        }
    }); // getConn
} // No.09 배송 요청 등록 및 미체결 계약 생성

// No.10  배송 요청 보기
function selectSending(deliveringId, callback) {
    var sql_select_sending = 'select s.id sending_id, c.id contract_id, s.here_lat here_lat, s.here_lon here_lon, ' +
                             's.addr_lat addr_lat, s.addr_lon addr_lon, s.info info, s.memo memo , ' +
                             'date_format(convert_tz(s.arr_time,?, ?), \'%Y-%m-%d %H:%i:%s\') arr_time, ' +
                             'cast(aes_decrypt(s.rec_phone , unhex(sha2(?, ?))) as char(45)) rec_phone, ' +
                             's.price price ' +
                             'from delivering d ' +
                             'join contract c on(d.contract_id = c.id) ' +
                             'join sending s on(c.id = s.contract_id) ' +
                             'where d.id = ?';

    var sql_select_file = 'SELECT f.filename, f.filepath ' +
                            'FROM delivering d ' +
                            'join contract c on(d.contract_id = c.id) ' +
                            'join sending s on(c.id = s.contract_id) ' +
                            'join file f on(f.fk_id = s.id) ' +
                            'where f.type = ? and d.id = ?';

    async.parallel([selectSending, selectFile], function(err, result) {
    // selectSending, selectFile을 동시에 실행
        if (err) {
            callback(err);
        }
        var info = {};
        if (result[0][0] === undefined) { // 값이 존재하지 않을 경우
            callback(null, 0);
        } else { // 값이 존재할 경우
            // result[0]은 selectSending의 값, result[1]은 selectFile의 값
            info.delivering_id = deliveringId;
            info.sending_id = result[0][0].sending_id; //sending id
            info.contract_id = result[0][0].contract_id; //constract의 id
            info.here_lat = result[0][0].here_lat; // 현재 위도
            info.here_lon = result[0][0].here_lon; // 현재 경도
            info.addr_lat = result[0][0].addr_lat; // 목적지 위도
            info.addr_lon = result[0][0].addr_lon; // 목적지 경도
            info.info = result[0][0].info || ""; // 물건 정보
            info.arr_time = result[0][0].arr_time; //도착 시각
            info.rec_phone = result[0][0].rec_phone; //수신자 전화번호
            info.price = result[0][0].price; //가격
            info.memo = result[0][0].memo || ""; //메모
            info.pic = []; //사진
            async.each(result[1], function (item, as_done) { // 파일이 2개 이상일 경우를 대비해 async.each 사용
                if (err) {
                    return as_done(err);
                }
                var filename = path.basename(item.filepath); // 파일이름 생성
                info.pic.push({
                    originalFilename: item.filename,
                    fileUrl: url.resolve(url_, '/sendings/' + filename) //file url 생성
                });
                as_done();
            }, function (err) {
                if (err) {
                    return callback(err);
                }
                callback(null, info);
            }); // async.each
        }
    }); // async.parallel

    function selectSending(callback) { // select sending_배송요청 출력
        dbPool.getConnection(function(err, dbConn) {
            if (err) {
                return callback(err);
            }
            dbConn.query(sql_select_sending, ['+00:00', '+09:00', process.env.MYSQL_SECRET, 512, deliveringId], function(err, result) {
                dbConn.release();
                if (err) {
                   callback(err);
                }
                callback(null, result);
            });
        });
    }

    function selectFile(callback) { // select file_배송요청 파일 출력
        dbPool.getConnection(function(err, dbConn) {
            if (err) {
                return callback(err);
            }
            dbConn.query(sql_select_file, [1, deliveringId], function(err, results) { // file type -> sending은 1 [DB]
                dbConn.release();
                if (err) {
                    return callback(err);
                }
                callback(null, results);
            });
        });
    }
} // No.10  배송 요청 보기

// No.14. 계약 신청하기
function requestContract(deliveringId, contractId, callback) {
    var sql_update_delivering = 'update delivering ' +
                              'set contract_id = ?, utime = now() ' +
                              'where id = ? ';
    var sql_update_contract = 'update contract set state = ?, utime = now() ' +
                              'where id = ? ';
    var changedRows = 0;
    // delivering 테이블에 contract_id, utime 변경

    dbPool.getConnection(function(err, dbConn) {
        if (err) {
            return callback(err);
        }
        dbConn.beginTransaction(function(err) {
            if (err) {
                dbConn.release();
                return callback(err);
            }
            async.series([updateDelivering, updateStateOfContract], function(err) {
                dbConn.release();
                if (err) {
                    return dbConn.rollback(function(){
                        callback(err);
                    });
                }
                dbConn.commit(function(){
                    callback(null, changedRows);
                });
            });
        });

    function updateDelivering(callback) {
        dbConn.query(sql_update_delivering, [contractId, deliveringId], function(err, result) {
            if (err) {
                return callback(err);
            }
            changedRows += result.changedRows;  // update확인을 위한 result.changeRows
            callback(null);
        });
    }
    function updateStateOfContract(callback) {
        dbConn.query(sql_update_contract, [1 ,contractId], function(err, result) {
            if (err) {
                return callback(err);
            }
            changedRows += result.changedRows;  // update확인을 위한 result.changeRows
            callback(null);
        });
    }
    });
} // No.14. 계약 신청하기

// No.15_1 계약 체결하기 _ 수락
function acceptContract(contractId, callback) {
    var sql_update_contract = 'update contract ' +
                              'set state = ?, res_time = str_to_date(now(), \'%Y-%m-%d %H:%i:%s\'), utime = now()' +
                              'where id = ? ';
                               // contract table에 state, res_time, utime 변경
    var sql_select_Sending = 'select id sending_id, user_id sending_user_id from sending where contract_id = ? ';
    dbPool.getConnection(function(err, dbConn) {
        if (err) {
            return callback(err);
        }
        async.series([changeStartState, selectSendingId], function(err, results) {
            dbConn.release();
            if (err) {
                return callback(err);
                }
            var data = {};
            data.changedRows = results[0];
            data.sending_id = results[1].sending_id;
            data.sending_user_id = results[1].sending_user_id;
            callback(null, data);
            });
        // series
        function changeStartState(done) {
            dbConn.query(sql_update_contract, [2, contractId], function(err, result) { // state -> 1_계약 완료 및 배송 전
                if (err) {
                    return done(err);
                }
                if (result.changedRows === 1) { //업데이트 확인을 위해 result.changeRows 존재
                    done(null, result.changedRows);
                } else {
                    done(new Error('contractID는 없습니다.'));
                }

            });
        }
        function selectSendingId(done) {
            dbConn.query(sql_select_Sending, [contractId], function(err, result) {
               if (err) {
                   return done(err);
               }
               done(null, result[0]);
            });
        }
    });
} // No.15_1 계약 체결하기 _ 수락

// No.15_9 계약 체결하기 _ 거절
function rejectContract(contractId, callback) {
    var sql_update_delivering = 'update delivering set contract_id = ?, utime = now() where contract_id = ? ';
                                //delivering table에 contract_id, utime 변경
    var sql_update_contract = 'update contract set state = ?, utime = now() where id = ? ';
    dbPool.getConnection(function(err, dbConn) {
        if (err) {
            return callback(err);
        }
        var changedRows = 0;
        dbConn.beginTransaction(function(err) {
            if (err) {
                dbConn.release();
                return callback(err);
            }
            async.series([updateDelivering, updateStateOfContract], function(err) {
                dbConn.release();
                if (err) {
                    return dbConn.rollback(function(){
                        callback(err);
                    });
                }
                dbConn.commit(function(){
                    callback(null, changedRows);
                });
            });
        });

    function updateDelivering(done) {
        dbConn.query(sql_update_delivering, [0, contractId], function(err, result) { // contract_id -> 0_미체결계약으로 변경
            if (err) {
                return done(err);
            }
            changedRows += result.changedRows;
            done(null); //업데이트 확인을 위해 result.changeRows 존재
        });
    }
    function updateStateOfContract(done) {
        dbConn.query(sql_update_contract, [0, contractId], function(err, result) { // contract_id -> 0_미체결계약으로 변경
            if (err) {
                return done(err);
            }
            changedRows += result.changedRows;
            done(null); //업데이트 확인을 위해 result.changeRows 존재
        });
    }

    });
} // No.15_9 계약 체결하기 _ 거절

// No.16 계약 내역 보기
function selectContract(contractId, callback) {
    var sql_select_contract =   'select c.id contract_id, s.id sender_id, d.id deliverer_id, ' +
                                'date_format(convert_tz(c.req_time, ?, ?), \'%Y-%m-%d %H:%i:%s\') req_time, ' +
                                'date_format(convert_tz(c.res_time, ?, ?), \'%Y-%m-%d %H:%i:%s\') res_time, ' +
                                'c.state state ' +// __컬럼명
                                'from contract c ' +
                                'join sending s on(c.id = s.contract_id) ' +
                                'left join delivering d on(c.id = d.contract_id) ' +
                                'where c.id = ? ';
                            // table -> contract, sendingm delivering
                            // col -> contract_id, sender_id, deliverer_id, req_time, res_time, state

    dbPool.getConnection(function(err, dbConn) {
       if (err) {
           return callback(err);
       }
       dbConn.query(sql_select_contract, ['+00:00', '+09:00', '+00:00', '+09:00', contractId], function(err, results) {
           dbConn.release();
           if (err) {
               return callback(err);
           }
           if (results.length !== 0) {
               callback(null, results[0]);
           } else {
               callback(null, 0);
           }

       });
    });
} // No.16 계약 내역 보기

// 배송 상태 변경 하기
function changeStateOfContract(contractId, state, callback) {
    var sql_change_contract = 'update contract set state = ?, utime = now() where id = ? ';
    dbPool.getConnection(function(err, dbConn) {
        if (err) {
            return callback(err);
        }
        dbConn.query(sql_change_contract, [state, contractId], function(err, result) {
            dbConn.release();
            if (err) {
                return callback(err);
            }
            callback(null, result.changedRows);
        });
    });
}

module.exports.changeStateOfContract = changeStateOfContract;
module.exports.requestContract = requestContract;
module.exports.selectContract = selectContract;
module.exports.acceptContract = acceptContract;
module.exports.rejectContract = rejectContract;
module.exports.insertSendingAndContract = insertSendingAndContract;
module.exports.selectSending = selectSending;
module.exports.getRegistrationToken = getRegistrationToken;