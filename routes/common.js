var logger = require('../common/logger');

function getLog(req, res, next) {
    logger.log('info', '%s %s://%s%s', req.method, req.protocol, req.headers['host'], req.originalUrl);
    logger.log('debug', 'method: %s', req.method);
    logger.log('debug', 'protocol: %s', req.protocol);
    logger.log('debug', 'host: %s', req.headers['host']);
    logger.log('debug', 'originalUrl: %s', req.originalUrl);
    logger.log('debug', 'baseUrl: %s', req.baseUrl);
    logger.log('debug', 'url: %s', req.url);
    logger.log('debug', 'secure: %j', req.secure, {});
    logger.log('debug', 'query: %j', req.query, {});
    logger.log('debug', 'body: %j', req.body, {});
    logger.log('debug', 'user: %j', req.user, {});
    logger.log('debug', 'range: %s', req.headers['range']);
    next();
}

function isAuthenticated(req, res, next) { // 세션 확인을 위해 추가
    if (!req.user) {
        return res.send({
            error: '로그인이 필요합니다.'
        });
        var err = new Error('login needed');
        err.status = 401;
        next(err);
    }

}

function isSecure(req, res, next) {// HTTPS 사용 위해 추가
    if(!req.secure) {
        return res.send({
            error: '프로토콜 변경이 필요합니다.'
        });
        var err = new Error('upgrade needed');
        err.status = 426;
        next(err);
    }

}

function isActivated(req, res, next) { // 세션 확인을 위해 추가
    if (req.user.activation !== 1) {
        return res.send({
            error: '핸드폰 번호 등록이 필요합니다.'
        });
        var err = new Error('activation needed');
        err.status = 401;
        next(err);
    }

}

module.exports.isAuthenticated = isAuthenticated;
module.exports.isSecure = isSecure;
module.exports.isActivated = isActivated;
module.exports.getLog = getLog;