var express = require('express');
var router = express.Router();
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
// var FacebookStrategy = require('passport-facebook').Strategy;
var FacebookTokenStrategy = require('passport-facebook-token');
var Customer = require('../models/member');
var isSecure = require('./common').isSecure;
var isAuthenticated = require('./common').isAuthenticated;

passport.use(new FacebookTokenStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    profileFields: ['id', 'displayName', 'name','gender', 'profileUrl', 'photos', 'emails']
}, function(accessToken, refreshToken, profile, done) {
    Customer.findOrCreateFacebook(profile, function (err, user) {// 추후 변수 수정 필요
        if(err) {
            return done(err);
        }
        return done(null, user);
    });
}));

// 1. use로 strategy 함수 만들기 - name, password가 기본필드라 옵션 변경해야함
passport.use(new LocalStrategy({usernameField: 'api_id', passwordField: 'password'}, function(api_id, password, done) {
    Customer.findById(api_id, function(err, user) {
        if (err) {
            return done(err);
        }
        if (!user) {
            return done(null, false);
        }
        done(null, user);
    });
}));

// 2. serializeUser 사용
passport.serializeUser(function(user, done) { //session에 아이디를 저장
    done(null, user.id);
});

passport.deserializeUser(function(id, done) { //session에 저장된 id를 복원하는 함수
    Customer.findUser(id, function(err, user) {
        if (err) {
            return done(err);
        }
        done(null, user);
    })
});


// 3. 실제경로에서 authenticate를 사용
router.post('/local/login', isSecure, function(req, res, next) {
    passport.authenticate('local', function (err, user) {
        if (err) {
            return next(err);
        }
        if (!user) {
            return res.status(401).send({
                message: 'login failed'
            });
        }
        req.login(user, function (err) {
            if (err) {
                return next(err);
            }
            next();
        });
    })(req, res, next);
}, function(req, res, next) {
    var user = {};
    user.name = req.user.api_id;
    res.send({
        message: 'local login',
        user: user
    });
});

router.get('/local/logout', isAuthenticated, function(req, res, next) {
    req.logout();
    res.send({ message: 'local logout' });
});

router.post('/facebook/token', isSecure, passport.authenticate('facebook-token', {scope : ['email']}), function(req, res, next) {
    res.send({
        user: req.user
    });
    // res.sendStatus(req.user ? 200 : 401);
});

module.exports = router;