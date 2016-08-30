var dbPool = require('./common').dbPool;
var url = require('url');
var path = require('path');
var async = require('async');

var url_ = 'http://ec2-52-78-70-38.ap-northeast-2.compute.amazonaws.com';

function findOrCreateFacebook(profile, callback) {
    var sql_find_facebook_id = 'SELECT id, phone, introduction, deliver_com, deliver_req FROM user WHERE api_id = ?';
    var sql_create_facebook_id = 'INSERT INTO user(api_id, api_type, activation) VALUES(?, 0, 0);';
    dbPool.getConnection(function (err, dbConn) {
       if (err) {
           return callback(err);
       }
       dbConn.query(sql_find_facebook_id, [profile.id], function (err, result) {
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
               dbConn.query(sql_create_facebook_id, [profile.id], function (err, result) {
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
    var sql_select_user = 'SELECT u.id user_id, u.api_id api_id, u.api_type api_type, u.introduction introduction, ' +
                          'u.deliver_com deliver_com, u.deliver_req deliver_req, u.activation activation, f.filepath filepath ' +
                          'FROM user u LEFT JOIN (SELECT fk_id, filename, filepath ' +
                          'FROM file WHERE type = 0) f ON (u.id = f.fk_id) WHERE u.id = ?';
    var sql_select_avg_star = 'SELECT AVG(star) avg_star FROM review r JOIN (SELECT id, user_id, contract_id ' +
                              'FROM delivering WHERE user_id = ?) a ON (r.contract_id = a.contract_id)';

    var user = {};

    dbPool.getConnection(function (err, dbConn) {
        if (err) {
            return callback(err);
        }
        async.parallel([getUserData, getUserStar], function(err, result) {
            dbConn.release();
            if (err) {
                return callback(err);
            }
            user.star = result[1].avg_star;
            callback(null, user);
        });

        function getUserData(done) {
            dbConn.query(sql_select_user, [userId], function (err, result) {
                if (err) {
                    return done(err);
                }
                user.id = result[0].user_id;
                user.api_id = result[0].api_id;
                user.api_type = result[0].api_type;
                user.introduction = result[0].introduction;
                user.deliver_com = result[0].deliver_com;
                user.deliver_req = result[0].deliver_req;
                user.activation = result[0].activation;
                if (result[0].filepath) {
                    user.pic = url.resolve(url_ ,'/uploads/images/profiles' + path.basename(result[0].filepath));
                } else {
                    user.pic = '';
                }
            });
            done(null);
        }

        function getUserStar(done) {
            dbConn.query(sql_select_avg_star, [userId], function (err, result) {
                if (err) {
                    return done(err);
                }
                done(null, result[0]);
            })
        }


    });
}

function updateMember(user, callback) {
    var sql = 'UPDATE user SET phone = ?, activation = 1 WHERE id = ?';
    dbPool.getConnection(function (err, dbConn) {
       if (err) {
           return callback(err);
       }
       dbConn.beginTransaction(function (err) {
           if (err) {
               dbConn.release();
               return callback(err);
           }
            dbConn.query(sql, [user.phone, user.id], function (err) {
                if (err) {
                    return dbConn.rollback(function() {
                        dbConn.release();
                        callback(err);
                    });
                }

                dbConn.commit(function () {
                    dbConn.release();
                    callback(null);
                });
            })
       })
    });
}

module.exports.findById = findById;
module.exports.findUser = findUser;
module.exports.findOrCreateFacebook = findOrCreateFacebook;
module.exports.updateMember = updateMember;