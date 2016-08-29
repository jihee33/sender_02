var async = require('async');
var dbPool = require('./common').dbPool;

function listReviews(currentPage, itemsPerPage, delivererId, callback) {
    var sql_select_reviews = 'SELECT r.user_id reviewer_id, r.content content, r.star star, ' +
                                    'date_format(convert_tz(r.ctime, ?, ?), \'%Y-%m-%d %H:%i:%s\') review_date ' +
                             'FROM review r RIGHT JOIN delivering d ON (r.contract_id = d.contract_id) ' +
                             'WHERE d.user_id = ? ' +
                             'ORDER BY date_format(convert_tz(r.ctime, ?, ?), \'%Y-%m-%d %H:%i:%s\') DESC LIMIT ?, ?';
    var sql_select_count = 'SELECT count(d.id) count FROM review r RIGHT JOIN delivering d ON (r.contract_id = d.contract_id) ' +
                           'WHERE d.user_id = ?';
    var queryResult = {};
    dbPool.getConnection(function(err, dbConn) {
        if (err) {
            return callback(err);
        }
        async.parallel([selectLimitDelivering, selectCountDelivering], function(err, result){
            dbConn.release();
            if (err) {
                return callback(err);
            }
            queryResult.totalPage = Math.ceil(result[1].count / itemsPerPage);
            queryResult.currentPage = currentPage;
            queryResult.itemsPerPage = itemsPerPage;
            queryResult.data = {};
            queryResult.data.review = [];
            if (!result[0]) {
                return callback(null, '해당하는 사용자가 없습니다');
            }
            if (result[0].length !== 1) {
                async.each(result[0], function(item, done) {
                    if (err) {
                        return done(err);
                    }
                    if (item.content !== null) {
                        queryResult.data.review.push(item);
                    }
                }, function(err) {
                    if (err) {
                        return callback(err);
                    }
                });
                if (!queryResult.data.review[0]) {
                    return callback(null, null);
                }
            } else {// if (result[0].length === 1) {
                if (result[0][0].content !== null) {
                    queryResult.data.review.push(result[0][0]);
                } else {
                    return callback(null, null);
                }
            }
            callback(null, queryResult);
        });
        function selectLimitDelivering(callback) {
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
        function selectCountDelivering(callback) {
            dbConn.query(sql_select_count, [delivererId], function(err, result) {
                if (err) {
                    return callback(err);
                }
                callback(null, result[0]);
            });
        }
    });
}

module.exports.listReviews = listReviews;