var mysql = require('mysql');
var dbPool = require('./common').dbPool;

function findOrCreateFacebook(profile, callback) {
    var sql_find_facebook_id = 'SELECT id, phone, introduction, deliver_com, deliver_req FROM user WHERE api_id = ?';
    var sql_create_facebook_id = 'INSERT INTO user(api_id, api_type, activation) VALUES(?, 0, 0);';
    dbPool.getConnection(function (err, dbConn) {
       if (err) {
           return callback(err);
       }
       dbConn.query(sql_find_facebook_id, [profile], function (err, result) {
           if (err) {
               return callback(err);
           }
           if (result.length !== 0) {
               dbConn.release();
               var user = {};
               user.id = result[0].id;
               user.phone = result[0].phone;
               user.introduction = result[0].introduction;
               user.deliver_com = result[0].deliver_com;
               user.deliver_req = result[0].deliver_req;
               return callback(null, user);
           }
           dbConn.beginTransaction(function (err) {
               if (err) {
                   dbConn.release();
                   return callback(err)
               }
               dbConn.query(sql_create_facebook_id, [profile], function (err, result) {
                   if (err) {
                       return dbConn.rollback(function() {
                           dbConn.release();
                           callback(err);
                       });
                   }

                   dbConn.commit(function () {
                       var user = {};
                       user.id = result.insertId;
                       user.api_id = profile.id;
                       user.api_type = 0;
                       user.activation = 0;
                       dbConn.release();
                       callback(null, user);
                   });
               });
           });
       })
    });
}

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
module.exports.findOrCreateFacebook = findOrCreateFacebook;