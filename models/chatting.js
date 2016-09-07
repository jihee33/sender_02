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

function getChattingLogs(data, callback) {
    var sql_get_chatting_log = 'SELECT id, sender_id, content, ctime date FROM chatting WHERE ctime < CURRENT_TIMESTAMP ' +
                               'AND receiver_id = ? AND type = 0 AND contract_id = ?';
    var sql_update_chatting_log = 'UPDATE chatting SET type = 1 WHERE id = ? AND type = 0 AND contract_id = ?';

    dbPool.getConnection(function(err, dbConn) {
        if (err) {
            return callback(err);
        }
        dbConn.beginTransaction(function(err) {
           if (err) {
               dbConn.release();
               return callback(err);
           }
            var log = {};
            log.message = [];
            log.date = [];
            dbConn.query(sql_get_chatting_log, [data.receiverId, data.contractId], function(err, results) {
                if (err) {
                    dbConn.rollback();
                    return dbConn.release();
                }
                async.each(results, function(item, done) {
                    log.message.push(item.content);
                    log.date.push(item.date);
                    dbConn.query(sql_update_chatting_log, [item.id, item.contractId], function(err) {
                        if (err) {
                            dbConn.rollback();
                            return dbConn.release();
                        }
                        done(null);
                    });
                }, function(err) {
                    if (err) {
                        return callback(err);
                    }
                });
                dbConn.commit();
                dbConn.release();
                callback(null, log);
            });
        });

    });


}

module.exports.getRegistrationToken = getRegistrationToken;
module.exports.insertFile = insertFile;
module.exports.getChattingLogs = getChattingLogs;