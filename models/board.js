var mysql = require('mysql');
var async = require('async');
var dbPool = require('./common').dbPool;
var path = require('path');
var url = require('url');
var fs = require('fs');
var url_ = 'http://ec2-52-78-70-38.ap-northeast-2.compute.amazonaws.com:8080'; //fixme : port 변경 -> 80

function insertBoard(data, callback) {
    var sql_insert_board_praiseAndDeclare = 'insert into board(user_id, name, board_type, es_type, title, content) ' +
                                            'values(?, ?, ?, ?, ?, ?)';
    var sql_insert_board_inquire = 'insert into board(user_id, name, board_type, title, content) ' +
                                   'values(?, ?, ?, ?, ?) ';
    var sql_insert_file = 'insert into file(type, fk_id, filename, filepath) ' +
                          'values(?, ?, ?, ?)';

    dbPool.getConnection(function(err, dbConn) {
        if (err) {
            return callback(err);
        }
        var affectedRows = 0;
        var recentBoardId = 0;
        dbConn.beginTransaction(function(err) {
            if (err) {
                return callback(err);
            }
            async.series([insertBoards, insertFiles], function(err, result) {
                dbConn.release();
                if (err) {
                    return callback(err);
                }
                callback(null, affectedRows);
            });
        });

        function insertBoards(done) {
            if (data.boardType === 0 || data.boardType === 1) {
                dbconn.query(sql_insert_board_praiseAndDeclare,
                    [data.user_id, data.name, data.boardType, data.esType, '', data.content],
                    function (err, result) {
                    if (err) {
                        return done(err);
                    }
                    affectedRows += result.affectedRows;
                    recentBoardId = result.insertId;
                    done(null);
                });
            } else if (data.boardType === 2) {
                dbconn.query(sql_insert_board_inquire,
                    [data.user_id, '', data.boardType, data.title, data.content],
                    function (err, result) {
                    if (err) {
                        return done(err);
                    }
                    affectedRows += result.affectedRows;
                    recentBoardId = result.insertId;
                    done(null);
                });
            } else {
                console.log('aa');
            }
        }
        function insertFiles(done) {
            async.each(data.pic, function (item, as_done) {
                dbConn.query(sql_insert_file, [recentBoardId, 2, item.name, item.path], function (err, result) { // file type -> board은 2 [DB]
                    if (err) {
                        return as_done(err);
                    }
                    affectedRows += result.affectedRows; // OK -> 2
                    as_done(null);
                });
            }, function (err) {
                if (err) {
                    return done(err);
                }
                done(null);
            });
        }
    });

    // TODO : transaction 써야함 board에 입력, file 입력
    // todo : parallel로 묶기



}
module.exports.insertBoard = insertBoard;