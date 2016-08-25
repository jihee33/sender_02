var mysql = require('mysql');
var dbPool = require('./common').dbPool;

function findById(apiId, callback) {
    var sql = 'SELECT id, api_id, api_type, introduction, deliver_com, deliver_req FROM user WHERE api_id = ?';
    dbPool.getConnection(function(err, dbConn) {
        if (err) {
            return callback(err);
        }
        dbConn.query(sql, [apiId], function (err, result) {
            dbConn.release();
            if (err) {
                return callback(err);
            } else if (result.length !== 0) {
                return callback(null, result[0]);
            } else {
                return callback(null, null);
            }
        });
    });
}

function findUser(userId, callback) {
    var sql = 'SELECT id, api_id, api_type, introduction, deliver_com, deliver_req FROM user WHERE id = ?';
    dbPool.getConnection(function (err, dbConn) {
        if (err) {
            return callback(err);
        }
        dbConn.query(sql, [userId], function (err, result) {
            dbConn.release();
            if (err) {
                return callback(err);
            }
            var user = {};
            user.id = result[0].id;
            user.api_id = result[0].api_id;
            user.api_type = result[0].api_type;
            user.introduction = result[0].introduction;
            user.deliver_com = result[0].deliver_com;
            user.deliver_req = result[0].deliver_req;
            return callback(null, user);
        });
    });
}

module.exports.findById = findById;
module.exports.findUser = findUser;
