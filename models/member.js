var dbPool = require('./common').dbPool;
var url = require('url');
var path = require('path');
var async = require('async');
var fs = require('fs');
var logger = require('../common/logger');

var url_ = 'http://ec2-52-78-70-38.ap-northeast-2.compute.amazonaws.com:80';

function findOrCreateFacebook(profile, callback) {
    var sql_find_facebook_id = 'SELECT id, ' +
                                'cast(aes_encrypt(name ,unhex(sha2( ?, ?))) as char(20)),' +
                                'introduction, deliver_com, deliver_req FROM user WHERE fb_id = ?';
    var sql_create_facebook_id = 'INSERT INTO user(fb_id, api_type, name, activation) VALUES(?, 0, aes_encrypt(?,unhex(sha2(?, ?))), 0);';
    dbPool.getConnection(function (err, dbConn) {
       if (err) {
           return callback(err);
       }
       dbConn.query(sql_find_facebook_id, [process.env.MYSQL_SECRET, 512, profile.id], function (err, result) {
           if (err) {
               return callback(err);
           }
           if (result.length !== 0) {
               dbConn.release();
               var user = {};
               user.id = result[0].id;
               user.phone = result[0].phone;
               user.introduction = result[0].introduction || '';
               user.deliver_com = result[0].deliver_com;
               user.deliver_req = result[0].deliver_req;
               return callback(null, user);
           }
           dbConn.beginTransaction(function (err) {
               if (err) {
                   dbConn.release();
                   return callback(err)
               }
               dbConn.query(sql_create_facebook_id, [profile.id, profile.displayName, process.env.MYSQL_SECRET, 512], function (err, result) {
                   if (err) {
                       return dbConn.rollback(function() {
                           dbConn.release();
                           callback(err);
                       });
                   }
                   var user = {};
                   user.id = result.insertId;
                   user.fb_id = profile.id;
                   user.api_type = 0;
                   user.activation = 0;
                   user.insert = 1;
                   dbConn.commit();
                   dbConn.release();
                   callback(null, user);
               });
           });
       });
    });
}

function updateRegistrationToken(regToken, userId, callback) {
    var sql = 'UPDATE user SET registration_token = ? WHERE id = ?';
    dbPool.getConnection(function(err, dbConn) {
        if(err) {
            return callback(err)
        }
        dbConn.query(sql, [regToken, userId], function(err) {
            dbConn.release();
            if (err) {
                return callback(err);
            }
            callback(null);
        });
    });
}

function findById(apiId, callback) {
    var sql = 'SELECT id, fb_id, api_type, introduction, deliver_com, deliver_req FROM user WHERE fb_id = ?';

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
    var sql_select_user = 'SELECT u.id user_id,' +
                          'cast(aes_decrypt(u.name, unhex(sha2(?, ?))) as char(20)) name,' +
                          'cast(aes_decrypt(u.phone, unhex(sha2(?, ?))) as char(35)) phone, u.fb_id fb_id, ' +
                          'u.api_type api_type, u.introduction introduction, ' +
                          'u.deliver_com deliver_com, u.deliver_req deliver_req, u.activation activation, f.filepath filepath ' +
                          'FROM user u LEFT JOIN (SELECT fk_id, filename, filepath ' +
                                                 'FROM file WHERE type = 0) f ON (u.id = f.fk_id) ' +
                                                 'WHERE u.id = ?';
    var sql_select_avg_star = 'SELECT AVG(star) avg_star ' +
                              'FROM review r JOIN (SELECT id, user_id, contract_id ' +
                                                  'FROM delivering WHERE user_id = ?) a ' +
                                                  'ON (r.contract_id = a.contract_id)';

    dbPool.getConnection(function (err, dbConn) {
        if (err) {
            return callback(err);
        }
        var user = {};

        async.parallel([getUserData, getUserStar], function(err, result) {
            dbConn.release();
            if (err) {
                return callback(err);
            }
            user.star = result[1].avg_star;
            callback(null, user);
        });

        function getUserData(done) {
            dbConn.query(sql_select_user, [process.env.MYSQL_SECRET, 512, process.env.MYSQL_SECRET, 512, userId], function (err, result) {
                if (err) {
                    return done(err);
                }
                if (result.length !== 0) {
                    user.id = result[0].user_id;
                    user.name = result[0].name;
                    user.phone = result[0].phone;
                    user.fb_id = result[0].fb_id;
                    user.api_type = result[0].api_type;
                    user.introduction = result[0].introduction;
                    user.deliver_com = result[0].deliver_com;
                    user.deliver_req = result[0].deliver_req;
                    user.activation = result[0].activation;
                    if (result[0].filepath) {
                        user.fileUrl = url.resolve(url_, '/profiles/' + path.basename(result[0].filepath));
                    } else {
                        user.fileUrl = url.resolve(url_, '/profiles/basic.png');
                    }
                } else {
                    user.message = '존재하지 않는 회원';
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
// 나의 물품을 배송한 사람 찾기 model
function findDeliverings(userId, callback) {
    var sql_find_deliverer = 'SELECT cast(aes_decrypt(u.name, unhex(sha2(?, ?))) as char(45)) dname, d.uid sid, d.duid duid, d.cstate cstate, ' +
                             'date_format(convert_tz(d.res_time, ?, ?), \'%Y-%m-%d %H:%i:%s\') res_time ' +
                             'FROM user u JOIN (SELECT u.id uid, s.id sid, s.contract_id con_id, d.id did, d.user_id duid, c.state cstate, c.res_time ' +
                                               'FROM user u JOIN sending s ON (u.id = s.user_id) ' +
                                                           'JOIN delivering d ON (s.contract_id = d.contract_id) ' +
                                                           'JOIN contract c ON (d.contract_id = c.id) ' +
                                                           'WHERE c.state = 3) d ON (u.id = d.duid) ' +
                             'WHERE d.uid = ?';

    var deliverer = {};
    deliverer.totalCount = 0;
    deliverer.data = [];

    dbPool.getConnection(function (err, dbConn) {
        if (err) {
            return callback(err);
        }
        dbConn.query(sql_find_deliverer, [process.env.MYSQL_SECRET, 512,'+00:00', '+09:00', userId], function (err, result) {
            dbConn.release();
            if (err) {
                return callback(err);
            }
            async.each(result, function (item, done) {
                if (err) {
                    return done(err);
                }
                deliverer.totalCount += 1;
                deliverer.data.push({
                    name : item.dname,
                    date : item.res_time
                });
            }, function (err) {
                if (err) {
                    return callback(err);
                }
            });
            if(deliverer.totalCount !== 0) {
                return callback(null, deliverer);
            }
            callback(null, '결과 없음')
        });
    });
}

function updateMember(user, callback) {
    logger.log('info', 'update member');
    logger.log('debug', 'user: %j', user, {});
    var sql = 'UPDATE user SET phone = AES_ENCRYPT(?,UNHEX(SHA2(?,?))), activation = 1 WHERE id = ?';
    dbPool.getConnection(function (err, dbConn) {
       if (err) {
           return callback(err);
       }
       dbConn.beginTransaction(function (err) {
           if (err) {
               dbConn.release();
               return callback(err);
           }
            dbConn.query(sql, [user.phone, process.env.MYSQL_SECRET, 512, user.id], function (err) {
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

function updateProfileImage(userId, file, callback) {
    var sql_delete_file = 'DELETE FROM file WHERE fk_id = ? AND type = 0';
    var sql_select_filepath = 'SELECT filepath FROM file WHERE fk_id = ? AND type = ?';
    var sql_insert_file = 'INSERT INTO file(type, fk_id, filename, filepath) VALUES (?, ?, ?, ?)';

    dbPool.getConnection(function(err, dbConn) {
        if (err) {
            return callback(err);
        }
        dbConn.beginTransaction(function (err) {
            if (err) {
                dbConn.release();
                return callback(err);
            }
            async.series([deleteRealFile, deleteFile, insertFile], function (err, result) {
                if (err) {
                    return dbConn.rollback(function () {
                        dbConn.release();
                        callback(err);
                    });
                }
                dbConn.commit(function () {
                    dbConn.release();
                    callback(null, result[1].affectedRows);
                });
            }); // async
        });
        function deleteRealFile(callback) {
            dbPool.query(sql_select_filepath, [userId, 0], function (err, result) {
                if (err) {
                    return callback(err);
                }
                async.each(result, function (item, callback) {
                    if (err) {
                        return callback(err);
                    }
                    if (!item.filepath) {
                        return callback(null, result);
                    }
                    fs.unlink(item.filepath, function (err) {
                        if (err) {
                            return callback(err);
                        }
                    });
                }); // async function
                callback(null, result);
            });
        } // deleteRealFile
        function deleteFile(callback) {
            dbPool.query(sql_delete_file, [userId], function (err, result) {
                if (err) {
                    return callback(err);
                }
                callback(null, result);
            });
        } // deleteFile
        function insertFile(callback) { // 여러개일때
            async.each(file, function (item, done) {
                dbConn.query(sql_insert_file, [0, userId, item[0].name, item[0].path], function (err, result) {
                    if (err) {
                        return done(err);
                    }
                    done(null, result);
                });
            }, function (err, result) {
                if (err) {
                    return callback(err);
                }
                callback(null, result);
            });
        }
    });
}

function deleteUser(userId, callback) {
    var sql_select_apiType = 'select api_type from user where id = ? ';
    var sql_reset_fbId = 'update user set fb_id = ? where id = ? ';
    var sql_reset_naverId = 'update user set naver_id = ? where id = ? ';

    dbPool.getConnection(function(err, dbConn) {
        if (err) {
            return callback(err);
        }
        async.waterfall([selectApiType, resetUserApiId], function(err, results){
            //api_type의 값을 알아와서 api_id를 초기화 해야함
            if (err) {
                return callback(err);
            }
            callback(null, results);
        });
        function selectApiType(done) { //api_id 추출
            dbConn.query(sql_select_apiType, [userId], function(err, result) {
                if (err) {
                    done(err);
                }
                done(null, result[0].api_type);
            });
        }
        function resetUserApiId(apiType, done) { // api_id값에 탈퇴id값을 삽입
            if (apiType === 0) {
                dbConn.query(sql_reset_fbId, ['444^*-^', userId], function (err, result) {
                    if (err) {
                        done(err);
                    }
                    console.log(result.changedRows);
                    done(null, result.changedRows);
                });
            } else if (apiType === 1) {
                dbConn.query(sql_reset_naverId, ['444^*-^', userId], function (err, result) {
                    if (err) {
                        done(err);
                    }
                    done(null, result.changedRows);
                });
            } else {
                done(new Error('apiType이 없습니다.'));
            }
        }
    });
}

module.exports.deleteUser = deleteUser;
module.exports.findById = findById;
module.exports.findUser = findUser;
module.exports.findOrCreateFacebook = findOrCreateFacebook;
module.exports.findDeliverings = findDeliverings;
module.exports.updateMember = updateMember;
module.exports.updateProfileImage = updateProfileImage;
module.exports.updateRegistrationToken = updateRegistrationToken;