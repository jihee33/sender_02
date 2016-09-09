var async = require('async');
var dbPool = require('./common').dbPool;
var url = require('url');
var path = require('path')
var logger = require('../common/logger');

var url_ = 'http://ec2-52-78-70-38.ap-northeast-2.compute.amazonaws.com:80';

function insertReview(reviewData, callback) {// 리뷰 등록
    var sql_insert_review = 'INSERT INTO review (user_id, contract_id, content, star) ' +
                            'VALUES (?, ?, ?, ?)';
    dbPool.getConnection(function(err, dbConn) {
        if (err) {
            return callback(err);
        }
        dbConn.query(sql_insert_review,
            [reviewData.userId, reviewData.contractId, reviewData.content, reviewData.star], function(err, result) {
                dbConn.release();
                if (err) {
                    return callback(err);
                }
                if (result.affectedRows === 1) {
                    callback(null, '리뷰 등록에 성공했습니다');
                } else {
                    callback(new Error('리뷰 등록에 실패했습니다.'));
                }
            });
    });
}

function listReviews(currentPage, itemsPerPage, delivererId, callback) {
    var sql_select_reviews = 'SELECT r.user_id reviewer_id, r.content content, r.star star, f.filepath filepath, ' +
                             'date_format(convert_tz(r.ctime, ?, ?), \'%Y-%m-%d %H:%i:%s\') review_date ' +
                             'FROM review r RIGHT JOIN delivering d ON (r.contract_id = d.contract_id)' +
                                           'LEFT JOIN (SELECT fk_id, filename, filepath from file where type = 0) f ON (f.fk_id = r.user_id) ' +
                             'WHERE d.user_id = ? ' +
                             'ORDER BY date_format(convert_tz(r.ctime, ?, ?), \'%Y-%m-%d %H:%i:%s\') DESC ' +
                             'LIMIT ?, ?';

    var sql_select_count = 'SELECT count(d.id) count FROM review r RIGHT JOIN delivering d ON (r.contract_id = d.contract_id) ' +
                           'WHERE d.user_id = ?';
    var queryResult = {};
    dbPool.getConnection(function(err, dbConn) {
        if (err) {
            return callback(err);
        }
        async.parallel([selectListReviews, selectCountReviews], function(err, result){
            dbConn.release();
            if (err) {
                return callback(err);
            }
            queryResult.totalPage = Math.ceil(result[1].count / itemsPerPage);
            queryResult.currentPage = currentPage;
            queryResult.itemsPerPage = itemsPerPage;
            queryResult.data = {};
            queryResult.data.review = [];
            logger.log('debug', 'result[0] : %j', result[0], {});
            if (!result[0]) {
                return callback(null, 0);
            }
            if (result[0].length !== 1) {
                async.each(result[0], function(item, done) {
                    if (err) {
                        return done(err);
                    }
                    if (item.content !== null) {
                        logger.log('debug', 'filepath : %j', item.filepath, {});
                        if (item.filepath) {
                            item.fileUrl = url.resolve(url_, '/profiles/' + path.basename(item.filepath));
                            delete item.filepath;
                        } else {
                            item.fileUrl = url.resolve(url_, '/profiles/basic.png');
                        }
                        queryResult.data.review.push(item);
                    }
                }, function(err) {
                    if (err) {
                        return callback(err);
                    }
                    done(null, queryResult);
                });
                if (!queryResult.data.review[0]) {
                    return callback(null, 0);
                }
            } else {// if (result[0].length === 1) {
                if (result[0][0].content !== null) {
                    if (result[0][0].filepath) {
                        result[0][0].fileUrl = url.resolve(url_, '/profiles/' + path.basename(result[0][0].filepath));
                        delete result[0][0].filepath;
                    } else {
                        result[0][0].fileUrl = url.resolve(url_, '/profiles/basic.png');
                    }
                    queryResult.data.review.push(result[0][0]);
                } else {
                    return callback(null, 0);
                }
            }
            logger.log('debug', 'review : %j', queryResult.data.review, {});
            // queryResult.data.review[0].delete(filepath);
            callback(null, queryResult);
        });
        function selectListReviews(callback) {
            dbConn.query(sql_select_reviews,
                ['+00:00', '+09:00', delivererId, '+00:00', '+09:00' , (itemsPerPage * (currentPage - 1)), itemsPerPage ],
                function(err, results) {
                    if (err) {
                        return callback(err);
                    }
                    if (results.length === 0) {
                        return callback(null, null);
                    }
                    callback(null, results);
                });
        }
        function selectCountReviews(callback) {
            dbConn.query(sql_select_count, [delivererId], function(err, result) {
                if (err) {
                    return callback(err);
                }
                callback(null, result[0]);
            });
        }
    });
}

module.exports.insertReview = insertReview;
module.exports.listReviews = listReviews;