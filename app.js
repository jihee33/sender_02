var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var session = require('express-session');
var passport = require('passport');
var redis = require('redis');// redis 사용 위해 require
var redisClient = redis.createClient();// 세션 정보 저장을 위한 redis client 설정
var RedisStore = require('connect-redis')(session);// 세션 정보 저장을 위한 redis 연결 설정
var auth = require('./routes/auth');// 인증 부분 router 연결
var board = require('./routes/board');// 사용자 게시물 등록 부분 router 연결
var chatting = require('./routes/chatting');// 채팅 부분 router 연결
var contract = require('./routes/contract');// 계약 부분 router 연결
var member = require('./routes/member');// 사용자 부분 router 연결
var notice = require('./routes/notice');// 공지사항 및 이벤트 부분 router 연결
var review = require('./routes/review');// 리뷰 부분 router 연결

var app = express();
app.set('env', 'development');
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(session({// redis seesion 생성 및 설정
  secret : process.env.SESSION_SECRET,
  store : new RedisStore({
    host : "127.0.0.1",
    port : 6379,
    client : redisClient
  }),
  resave : true,
  saveUninitialized : false
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/sendings', express.static(path.join(__dirname, 'uploads/images/sendings')));// 배송 요청 사진 접근 위한 static service url 선언
app.use('/profiles', express.static(path.join(__dirname, 'uploads/images/profiles')));
app.use('/board',express.static(path.join(__dirname, 'uploads/images/boards')));
app.use('/chatting',express.static(path.join(__dirname, 'uploads/images/chattings')));


app.use('/auth', auth);// 인증 부분 model 연결
app.use('/boards', board);// 사용자 게시물 부분 router
app.use('/chattings', chatting);//
app.use('/contracts', contract);
app.use('/members', member);
app.use('/notices', notice);
app.use('/reviews', review);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
