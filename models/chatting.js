var dbPool = require('./common').dbPool;
var url = require('url');
var path = require('path');
var async = require('async');
var fs = require('fs');
var logger = require('../common/logger');

function getRegistrationToken(receiverId, callback) {
    var sql_select_registration_token = 'SELECT registration_token FROM user WHERE id = ?';
    dbPool.getConnection(function(err, dbConn) {
       if (err) {
           return callback(err);
       }
       dbConn.query(sql_select_registration_token, [receiverId], function(err, results) {
          dbConn.release();
           if (err) {
              return callback(err);
          }
          callback(null, results[0]);
       });
    });
}

function insertChattingLog(data, callback) {
    var sql_insert_into_chatting = 'INSERT INTO chatting(sender_id, receiver_id, contract_id, content, type) ' +
                                   'VALUES (?, ?, ?, ?, ?)';
    logger.log('info', 'inside insertChattingLog');
    logger.log('debug', 'message: %j', data.message, {});
    logger.log('debug', 'pic: %j', data.pic, {});
    dbPool.getConnection(function(err, dbConn) {
        if(err) {
            return callback;
        }
        dbConn.beginTransaction(function(err) {
            if (err) {
                dbConn.release();
                return callback(err);
            }
            if (data.message && data.pic) {
                var contents = [];
                contents.push(data.message);
                contents.push(data.pic[1].url);
                async.eachSeries(contents, function (item, done) {
                    dbConn.query(sql_insert_into_chatting, [data.senderId, data.receiverId, data.contractId, item, 0], function(err) {
                        if (err) {
                            dbConn.rollback();
                            dbConn.release();
                            return done(err);
                        }
                        done(null);
                    });
                }, function (err) {
                    if (err) {
                        return callback(err);
                    }
                    dbConn.commit();
                    dbConn.release();
                    callback(null);
                });
            } else if (data.message && !data.pic) {
                dbConn.query(sql_insert_into_chatting, [data.senderId, data.receiverId, data.contractId, data.message, 0], function(err) {
                    if (err) {
                        dbConn.rollback();
                        dbConn.release();
                        return callback(err);
                    }
                    dbConn.commit();
                    dbConn.release();
                    callback(null);
                });
            } else if (data.pic && !data.message) {
                dbConn.query(sql_insert_into_chatting, [data.senderId, data.receiverId, data.contractId, data.pic[1].url, 0], function(err) {
                    if (err) {
                        dbConn.rollback();
                        dbConn.release();
                        return callback(err);
                    }
                    dbConn.commit();
                    dbConn.release();
                    callback(null);
                });
            }
        });
    });
}

function getChattingLogs(data, callback) {
    var sql_get_chatting_log =  'SELECT id, sender_id, content, date_format(convert_tz(ctime,?, ?), \'%Y-%m-%d %H:%i:%s\') date ' +
                                'FROM chatting ' +
                                'WHERE date_format(convert_tz(ctime,?, ?) < CURRENT_TIMESTAMP ' +
                                      'AND receiver_id = ? ' +
                                      'AND type = 0 ' +
                                      'AND contract_id = ? ';
    var sql_update_chatting_log = 'UPDATE chatting SET type = ? ' +
                                  'WHERE id = ? ' +
                                  'AND type = ? ' +
                                  'AND contract_id = ?';

    dbPool.getConnection(function(err, dbConn) {
        if (err) {
            return callback(err);
        }
        dbConn.beginTransaction(function(err) {
           if (err) {
               dbConn.release();
               return callback(err);
           }
            var log = [];
            dbConn.query(sql_get_chatting_log, [ '+00:00', '+09:00', '+00:00', '+09:00', data.receiverId, data.contractId], function(err, results) {
                if (err) {
                    dbConn.rollback();
                    dbConn.release();
                    return callback(err);
                }
                async.each(results, function(item, done) {
                    log.push({
                        message : item.content,
                        date : item.date
                    });

                    dbConn.query(sql_update_chatting_log, [1, item.id, 0, item.contractId], function(err) {
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
module.exports.insertChattingLog = insertChattingLog;
module.exports.getChattingLogs = getChattingLogs;