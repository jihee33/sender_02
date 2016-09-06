var dbPool = require('./common').dbPool;
var url = require('url');
var path = require('path');
var async = require('async');
var fs = require('fs');

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

function insertFile() {

}

function getChattingLogs() {

}

module.exports.getRegistrationToken = getRegistrationToken;
module.exports.insertFile = insertFile;
module.exports.getChattingLogs = getChattingLogs;