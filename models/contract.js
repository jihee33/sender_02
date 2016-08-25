var mysql = require('mysql');
var async = require('async');
var dbPool = require('./common').dbPool;
var path = require('path');
var url = require('url');
var fs = require('fs');

function insertSendingContract(data, callback) {
    var sql_insert_contract = 'insert contract(state) values(?)';
    var sql_insert_sending = '';
    var sql_insert_file = '';
    // TODO : sql
    // TODO : getconnection - trasacton
    // TODO : async.series - func3개 1.insertSending 2.insertFile 3.insertContract

    dbPool.getConnections(function(err, dbConn) {
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
                    callback(null, null);
                });
            }); // async.series
        }); // transaction
        function insertSending(callback) {

        }
        function insertFile(callback) {

        }
        function insertContract(callback) {

        }
    }); // getconn
}

module.exports.insertSendingContract = insertSendingContract;