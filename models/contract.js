var mysql = require('mysql');
var async = require('async');
var dbPool = require('./common').dbPool;
var path = require('path');
var url = require('url');
var fs = require('fs');
var url_ = 'http://ec2-52-78-70-38.ap-northeast-2.compute.amazonaws.com:8080'; //fixme : port 변경 -> 80

// No.09 배송 요청 등록 및 미체결 계약 생성
function insertSendingContract(data, callback) {
    var sql_insert_contract = 'insert into contract(state) values(?)';
    var sql_insert_sending = 'insert into sending (user_id, contract_id, here_lat, here_lon, addr_lat, addr_lon, info, arr_time, rec_phone, price, memo) ' +
                             'VALUES ( ?, ?, ?, ?, ?, ?, ?, str_to_date(?,\'%Y-%m-%d %H:%i:%s\'), ?, ?, ?)';
    var sql_insert_file = 'insert into file(fk_id, type, filename, filepath) values(?, ?, ? ,?)';
    var affectedRows = 0;
    var ins_cont_id = '';
    var ins_send_id = '';

    dbPool.getConnection(function(err, dbConn) {
        if (err) {
            return callback(err);
        }
        dbConn.beginTransaction(function (err) {
            if (err) {
                dbConn.release();
                return callback(err);
            }
            async.series([insertContract, insertSending, insertFile], function(err) {
                // insertContract, insertSending, insertFile을 순서대로 실행
                if (err) {
                    return dbConn.rollback(function (){
                       dbConn.release();
                       callback(err);
                   });
                }
                dbConn.commit(function () {
                    dbConn.release();
                    var data = {};
                    data.affectedRows = affectedRows; // OK -> 3 올바르게 진행된 insert문의 개수
                    data.ins_cont_id = ins_cont_id; // contract의 id
                    data.ins_send_id = ins_send_id; // sending의 id
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
                ins_cont_id = result.insertId; // 새로 생긴 constract의 id 삽입
                done(null);
            });
        }

        function insertSending(done) { // sending 생성_베송 요청 등록
            dbConn.query(sql_insert_sending, [data.user_id, ins_cont_id, data.here_lat, data.here_lon, data.addr_lat, data.addr_lon, data.info,
            data.arr_time, data.rec_phone, data.price, data.memo],
            function(err, result) {
                if (err) {
                    return done(err);
                }
                affectedRows += result.affectedRows; // OK -> 2
                ins_send_id = result.insertId; // 새로 생긴 sending의 id 삽입
                done(null);
            });
        }

        function insertFile(done) { // file 생성_배송 요청 파일 등록
            if (data.pic.length === 0) { // 사진이 없을 경우
                dbConn.query(sql_insert_file, [ins_send_id, 1, '', ''], function (err, result) { // file type -> sending은 1 [DB]
                    if (err) {
                        return done(err);
                    }
                    affectedRows += result.affectedRows; // OK -> 3
                    done(null);
                });
            } else { // 사진이 있는 경우
                async.each(data.pic, function (item, as_done) { // 파일이 2개 이상일 경우를 대비해 async.each 사용
                    dbConn.query(sql_insert_file, [ins_send_id, 1, item.name, item.path], function (err, result) { // file type -> sending은 1 [DB]
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
        }

    }); // getConn
} // No.09 배송 요청 등록 및 미체결 계약 생성

// No.10  배송 요청 보기
function selectSendingForDelivering(deliveringId, callback) {
    var sql_select_sending = 'select s.id sending_id, c.id contract_id, s.here_lat here_lat, s.here_lon here_lon, ' +
                                    's.addr_lat addr_lat, s.addr_lon addr_lon, s.info info, ' +
                                    'date_format(convert_tz(s.arr_time, ?, ?), \'%Y-%m-%d %H:%i:%s\') arr_time, ' +
                                    's.rec_phone rec_phone, s.price price ' + //__ 여기 까지 컬럼 명
                                    'from delivering d ' +
                                    'join contract c on(d.contract_id = c.id) ' +
                                    'join sending s on(c.id = s.contract_id) ' +
                                    'where d.id = ? ';
    //table -> delivering + contract + sending
    // col -> sending_id, contract_id, here_lat, here_lon, addr_lat, addr_lon, info, arr_time, rec_phone, price

    var sql_select_file = 'SELECT filename, filepath FROM file where type = ? and fk_id = ? ';
    var info = {};

    dbPool.getConnection(function(err, dbConn) {
                if (err) {
                    return callback(err);
                }
                async.parallel([selectSending, selectFile], function(err, result) {
                    // selectSending, selectFile을 동시에 실행
                    dbConn.release();
                    if (err) {
                        callback(err);
                    }
                    // result[0]은 selectSending의 값, result[1]은 selectFile의 값
                    info.sending_id = result[0][0].sending_id; //sending id
                    info.contract_id =  result[0][0].contract_id; //constract의 id
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
                    async.each(result[1], function(item, as_done) { // 파일이 2개 이상일 경우를 대비해 async.each 사용
                       if (err) {
                           return as_done(err);
                       }
                        var filename = path.basename(item.filepath); // 파일이름 생성
                        info.pic.push({
                            originalFilename : item.filename,
                            fileUrl : url.resolve(url_, '/sending/' + filename) //file url 생성
                        });
                        as_done();
                    });
                   callback(null, info);
                }); // async.parallel

    function selectSending(callback) { // select sending_배송요청 출력
        dbConn.query(sql_select_sending, ['+00:00', '+09:00', deliveringId], function(err, result) {
           if (err) {
               callback(err);
           }
           callback(null, result);
        });
    }

    function selectFile(callback) { // select file_배송요청 파일 출력
        dbConn.query(sql_select_file, [1, deliveringId], function(err, results) { // file type -> sending은 1 [DB]
            if (err) {
                return callback(err);
            }
            callback(null, results);
        });
    }
    }); //getConn
} // No.10  배송 요청 보기

// No.11 배달 가기 목록 보기
function listDelivering(currentPage, itemsPerPage, callback) {
    var sql_select_delivering_review_user ='SELECT d.id delivering_id, d.user_id user_id, u.name name, u.phone phone, ' +
                            'r.avg_star star, d.here_lat here_lat, d.here_lon here_lon, d.next_lat next_lat, d.next_lon next_lon, ' +
                            'date_format(convert_tz(d.dep_time, ?, ?), \'%Y-%m-%d %H:%i:%s\') dep_time, ' +
                            'date_format(convert_tz(d.arr_time, ?, ?), \'%Y-%m-%d %H:%i:%s\') arr_time, ' +
                            'f.filename filename, f.filepath filepath ' + //___여기까지 컬럼명
                            'from delivering d ' +
                            'join user u on(u.id = d.user_id) ' +
                            'left join (SELECT fk_id, filename, filepath, type from file WHERE type = 0) f on(u.id = f.fk_id) ' +
                            'left join ( ' +
                                'SELECT a.user_id user_id, AVG(star) avg_star ' +
                                'FROM  delivering a ' +
                                'left JOIN review r ON (r.contract_id = a.contract_id))r ' +
                            'on ( d.user_id = r.user_id) ' +
                            'group by d.id ' +
                            'order by d.id limit ?, ?';
                            // table -> delivering + user + file[type 0(user)인 table] + (delivering + review)[평균 별점을 위한 table]
                            // col -> delivering_id, user_id, name, phone, star, here_lat, here_lon, next_lat, next_lon,
                            //        dep_time, arr_time, filename, filepath

    var sql_select_count = 'select count(id) count from delivering';
    var info = {};

    dbPool.getConnection(function(err, dbConn) {
        if (err) {
            return callback(err);
        }
        async.parallel([selectLimitDelivering, selectCountDelivering], function(err, result){
            // selectLimitDelivering, selectCountDelivering을 동시에 실행
            if (err) {
                return callback(err);
            }
            //result[1]은 selectCountDelivering 값
            info.totalPage = Math.ceil(result[1].count / itemsPerPage); // 총 페이지를 itemsPerPage로 나눠 올림
            info.currentPage = currentPage; // 현재 페이지
            info.itemsPerPage = itemsPerPage; // rowCount
            info.data = [];

            async.each(result[0], function(item, callback) { //  result[0]은 selectLimitDelivering 값
                if (err) {
                    return callback(err);
                }
                info.data.push({
                    delivering_id : item.delivering_id,
                    user_id : item.user_id, // 사용자 아이디
                    name : item.name, // 이름
                    phone : item.phone, //수신자 핸드폰 번호
                    star : item.star, // 평균 별점
                    here_lat : item.here_lat, // 현위치 위도
                    here_lon : item.here_lon, // 현위치 경도
                    next_lat : item.next_lat, // 행선지 위도
                    next_lon : item.next_lon, // 행선지 경도
                    dep_time : item.dep_time, // 출발 시각
                    arr_time : item.arr_time, // 도착 시각
                    originalFilename : item.filename, // 파일명
                    fileUrl : url.resolve(url_, '/profiles/' + path.basename(item.filepath)) // file url
                });
                callback();
            });
            callback(null, info);
        }); // parallel

        function selectLimitDelivering(done) {
            dbConn.query(sql_select_delivering_review_user,
                ['+00:00', '+09:00', '+00:00', '+09:00' ,itemsPerPage * (currentPage - 1), itemsPerPage ],
                function(err, results) {
                    if (err) {
                        return done(err);
                    }
                    if (results.length === 0) {
                        return done(null, null);
                    }
                    done(null, results);
                });
        } // select_[delivering + user + file + review]_페이지 출력

        function selectCountDelivering(done) {
            dbConn.query(sql_select_count, [], function(err, result) {
                if (err) {
                    return done(err);
                }
                done(null, result[0]);
            });
        } // 배달 가기 카운트 출력_totalPage를 위해 존재
    });// getConn
} // No.11 배달 가기 목록 보기

// No.12 ‘배달가기’ 상세 목록 보기
function listIdDelivering(deliverId, callback) {
    var sql_select_delivering_id = 'select d.id deilvering_id, d.user_id, u.name name, ' +
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
        dbConn.query(sql_select_delivering_id, ['+00:00', '+09:00', '+00:00', '+09:00', deliverId], function(err, result) {
            dbConn.release();
            if (err) {
                callback(err);
            }
            callback(null, result);
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
               var info = {};
               info.bool =  result.affectedRows; // insert가 제대로 되었다면 OK -> 1
               info.delivering_id = result.insertId; // 입력된 delivering의 id
            if (err) {
                return callback(err);
            }
           callback(null, info);
       });
    });
} // No.13  ‘배달 가기’ 등록

// No.14. 계약 신청하기
function plzContract(deliveringId, contractId, callback) {
    var sql_update_contract = 'update delivering ' +
        'set contract_id = ?,' +
        ' utime = now()' +
        ' where id = ? ';
    // delivering 테이블에 contract_id, utime 변경
    dbPool.getConnection(function(err, dbConn) {
        if (err) {
            return callback(err);
        }
        dbConn.query(sql_update_contract, [contractId, deliveringId], function(err, result) {
            dbConn.release();
            if (err) {
                return callback(err);
            }
            callback(null, result.changedRows); // update확인을 위한 result.changeRows
        });
    });
} // No.14. 계약 신청하기

// No.15_1 계약 체결하기 _ 수락
function updateContract1(contractId, callback) {
    var sql_update_contract = 'update contract ' +
                                    'set state = ?, ' +
                                    'res_time = str_to_date(now(), \'%Y-%m-%d %H:%i:%s\') ' +
                                    ',utime = now()' +
                                    'where id = ? ';
                               // contract table에 state, res_time, utime 변경
    dbPool.getConnection(function(err, dbConn) {
        if (err) {
            return callback(err);
        }
        dbConn.query(sql_update_contract, [1, contractId], function(err, result) { // state -> 1_계약 완료 및 배송 전
            dbConn.release();
            if (err) {
                return callback(err);
            }
            callback(null, result.changedRows); //업데이트 확인을 위해 result.changeRows 존재
        });
    });
} // No.15_1 계약 체결하기 _ 수락

// No.15_9 계약 체결하기 _ 거절
function updateContract9(contractId, callback) {
    var sql_update_contract = 'update delivering ' +
                                'set contract_id = ?, ' +
                                'utime = now() ' +
                                'where contract_id = ? ';
                                //delivering table에 contract_id, utime 변경
    dbPool.getConnection(function(err, dbConn) {
        if (err) {
            return callback(err);
        }
        dbConn.query(sql_update_contract, [0, contractId], function(err, result) { // contract_id -> 0_미체결계약으로 변경
            dbConn.release();
            if (err) {
                return callback(err);
            }
            callback(null, result.changedRows); //업데이트 확인을 위해 result.changeRows 존재
        });
    });
} // No.15_9 계약 체결하기 _ 거절

// No.16 계약 내역 보기
function selectContract(contractId, callback) {
    var sql_select_contract = 'select c.id contract_id, s.id sender_id, d.id deliverer_id, ' +
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
       if (err) {return callback(err);}
       dbConn.query(sql_select_contract, ['+00:00', '+09:00', '+00:00', '+09:00', contractId], function(err, results) {
           dbConn.release();
           if (err) {
               return callback(err);
           }
            callback(null, results[0]);
       });
    });
} // No.16 계약 내역 보기

module.exports.plzContract = plzContract;
module.exports.selectContract = selectContract;
module.exports.updateContract1 = updateContract1;
module.exports.updateContract9 = updateContract9;
module.exports.insertDelivering = insertDelivering;
module.exports.insertSendingContract = insertSendingContract;
module.exports.selectSendingForDelivering = selectSendingForDelivering;
module.exports.listDelivering = listDelivering;
module.exports.listIdDelivering = listIdDelivering;