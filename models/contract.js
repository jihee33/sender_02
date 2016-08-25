var mysql = require('mysql');
var async = require('async');
var dbPool = require('./common').dbPool;
var path = require('path');
var url = require('url');
var fs = require('fs');

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
        }
        function insertSending(done) {
            dbConn.query(sql_insert_sending, [data.user_id, ins_cont_id, data.addr_lat, data.addr_lon, data.info,
            data.arr_time, data.rec_phone, data.price, data.memo],
            function(err, result) {
                if (err) {return done(err);}
                ins_send_id = result.insertId;
                done(null);
            });
        }
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
        }
    }); // getconn
}

module.exports.insertSendingContract = insertSendingContract;