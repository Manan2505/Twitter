var express = require("express");
var session = require("express-session");
var bodyParser = require("body-parser");
var app = express();

var db = require("./database_con.js");
const sendVerifyemail = require("./mailSender.js");
app.use(express.static(__dirname + "/public"));
app.use(session({ secret: "test123!@#" }));
app.use(bodyParser.urlencoded({ extended: true }));

var multer = require("multer");
var storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + req.session.userid + "-" + file.originalname);
  },
});
var upload_detail = multer({ storage: storage });

app.set("view engine", "ejs");

//login form
app.get("/", function (req, res) {
  var msg = "";
  if (req.session.msg != "") msg = req.session.msg;
  res.render("login", { msg: msg });
});
app.post("/login_submit", function (req, res) {
  const { email, pass } = req.body;
  let sql = "";
  if (isNaN(email)) {
    sql =
      "select * from user where email = '" +
      email +
      "' and password = '" +
      pass +
      "' and status = 1 and softdelete = 0";
  } else {
    sql =
      "select * from user where mobile = '" +
      email +
      "' and password = '" +
      pass +
      "' and status = 0 and softdelete = 0";
  }
  db.query(sql, function (err, result, fields) {
    if (err) throw err;
    if (result.length == 0) {
      res.render("login", { msg: "Invalid Credentials,or not verified email" });
    } else {
      req.session.userid = result[0].uid;
      req.session.un = result[0].username;
      res.redirect("/home");
    }
  });
});
app.get("/signup", function (req, res) {
  res.render("signup", { errmsg: "" });
});
app.post("/reg_submit", (req, res) => {
  const { fname, mname, lname, email, pass, cpass, dob, gender } = req.body;
  let username = "@" + fname + lname;
  let sql_check = "";

  if (isNaN(email)) {
    sql_check = "select email from user where email ='" + email + "';";
  } else {
    sql_check = "select mobile from user where mobile =' " + email + "';";
  }
  db.query(sql_check, function (err, result, fields) {
    if (err) {
      throw err;
    }
    if (result.length == 1) {
      let errmsg = "";
      if (isNaN(email)) {
        errmsg = "Email already exists !";
      } else {
        errmsg = "Mobile No. already exists !";
      }

      res.render("signup", { errmsg: errmsg });
    } else {
      //code for inserting value in database;
      let sql = "";
      if (isNaN(email))
        sql =
          "insert into user(fname,mname,lname,email,password,gender,dor,dob,username) values(?,?,?,?,?,?,?,?,?)";
      else
        sql =
          "insert into user(fname,mname,lname,mobile,password,gender,dor,dob,username) values(?,?,?,?,?,?,?,?,?)";
      let t = new Date();
      let m = t.getMonth() + 1;
      let dor = t.getFullYear() + "-" + m + "-" + t.getDate();
      db.query(
        sql,
        [fname, mname, lname, email, pass, gender, dob, dor, username],
        function (err, result) {
          if (err) throw err;

          if (result.insertId > 0) {
            if (isNaN(email)) {
              sendVerifyemail(
                email,
                "Verification Email",
                '<h2>Please Verify your email,and complete SignUp</h2> <a href="http://localhost:8080/verifyemail?email=' +
                  email +
                  '">Click to verify</a> '
              );
              req.session.msg =
                "Account created, please check mail to verify email";
            } else {
              req.session.msg = "Account created,Please Login";
            }
            res.redirect("/");
          } else {
            res.render("signup", {
              errmsg: "cannot complete signup try again",
            });
          }
        }
      );
    }
  });
});
app.listen(8080, function () {
  console.log("server runninng at localhost 8080 port");
});

app.get("/home", function (req, res) {
  let msg = "";
  if (req.session.msg != "") {
    msg = req.session.msg;
  }
  if (req.session.userid == "") {
    req.session.msg = "Please login first to view home";
    res.redirect("/");
  }
  let sql =
    "select * from tweet inner join user on user.uid=tweet.uid where tweet.uid=? or tweet.uid in (select follow_id from user_follows where uid=?) or tweet.post like '%" +
    req.session.un +
    "%' order by tweet.datetime desc";

  db.query(sql, [req.session.userid, req.session.userid], (err, result) => {
    if (err) {
      throw err;
    }

    res.render("home", { result: result, msg: msg });
  });
});
app.get("/logout", function (req, res) {
  req.session.userid = "";
  req.session.msg = "";
  req.session.un = "";
  res.redirect("/");
});

app.get("/editprofile", function (req, res) {
  db.query(
    "select * from user where uid=?",
    [req.session.userid],
    function (err, result, fields) {
      if (err) throw err;
      if (result.length == 1) {
        res.render("editprofile", { msg: "", result: result });
      } else res.redirect("/");
    }
  );
});

app.post(
  "/editprofile_submit",
  upload_detail.single("profile_img"),
  (req, res) => {
    const { fname, mname, lname, about } = req.body;
    var filename = "";
    try {
      filename = req.file.filename;
    } catch (err) {
      console.log(err);
    }
    let sqlupdate =
      "update user set fname=?,mname=?,lname=?,profilepic=?,about=? where uid=?";

    db.query(
      sqlupdate,
      [fname, mname, lname, filename, about, req.session.userid],
      (err, result) => {
        if (result.affectedRows == 1) {
          req.session.msg = "data updated";
          res.redirect("/home");
        } else {
          req.session.msg = "can not update profile";
          res.redirect("/home");
        }
      }
    );
  }
);

app.get("/followers", (req, res) => {
  let sql =
    "select * from user where uid in (select uid from user_follows where follow_id=?)";

  db.query(sql, [req.session.userid], (err, result, fields) => {
    if (err) {
      throw err;
    }
    res.render("followers_view", { result: result, msg: "" });
  });
});
app.get("/following", (req, res) => {
  let sql =
    "select * from user where uid in (select follow_id from user_follows where uid=?)";

  db.query(sql, [req.session.userid], (err, result, fields) => {
    if (err) {
      throw err;
    }
    res.render("following_view", { result: result, msg: "" });
  });
});

// whenever a file is uploaded it is first saved in temp folder of server till script is executing, so we have to save it in our folder before its get deleted

app.post("/tweet_submit", upload_detail.single("tweet_img"), (req, res) => {
  const { post } = req.body;
  // console.log(req.file);
  // console.log(req.file.filename);
  var filename = "";
  var mimetype = "";
  try {
    filename = req.file.filename;
    mimetype = req.file.mimetype;
  } catch (err) {
    // console.log(err);
  }
  var d = new Date();
  var m = d.getMonth() + 1;
  var ct =
    d.getFullYear() +
    "-" +
    m +
    "-" +
    d.getDate() +
    " " +
    d.getHours() +
    ":" +
    d.getMinutes() +
    ":" +
    d.getSeconds();

  let sql =
    "insert into tweet(uid,post,datetime,image_vdo_name,type) values(?,?,?,?,?)";

  db.query(
    sql,
    [req.session.userid, post, ct, filename, mimetype],
    (err, result) => {
      if (err) {
        throw err;
      }
      if (result.insertId > 0) {
        req.session.msg = "tweet done";
      } else {
        req.session.msg = "can not tweet your post";
      }
      res.redirect("/home");
    }
  );
});

app.get("/verifyemail", (req, res) => {
  const email = req.query["email"];
  var sql = "update user set status=1 where email=?";

  db.query(sql, [email], (err, result) => {
    if (err) {
      throw err;
    }

    if (result.affectedRows == 1) {
      req.session.msg = "Email verified, please login";
      res.redirect("/");
    } else {
      req.session.msg = "Email cannot be verified,contact admin";
      res.redirect("/");
    }
  });
});

app.get("/changepwd", (req, res) => {
  const email = req.query["email"];
  res.render("changepassword", { msg: "", email: email });
});

app.post("/changepassword_submit", (req, res) => {
  const { pass, cpass, email } = req.body;
  if (pass !== cpass) {
    res.render("changepassword", { msg: "Password does not match" });
    return;
  }
  let sqlupdate = "update user set password=? where email=?";

  db.query(sqlupdate, [pass, email], (err, result) => {
    if (err) {
      throw err;
    }
    if (result.affectedRows == 1) {
      req.session.msg = "password updated";
      res.redirect("/");
    } else {
      req.session.msg = "can not update password";
      res.redirect("/");
    }
  });
});

// profilepic and headerpic upload ->  hw
app.get("/fpwd", (req, res) => {
  res.render("fpassword");
});

app.post("/fpwd_submit", (req, res) => {
  const { email } = req.body;
  var sql = "select email from user where email=?";

  db.query(sql, [email], (err, result) => {
    if (err) {
      throw err;
    }
    if (result.length === 0) {
      res.render("signup", { errmsg: "Not a registered User!" });
    } else {
      sendVerifyemail(
        email,
        "Reset Password",
        '<h2>Click the below Link to Reset your Password</h2> <a href="http://localhost:8080/changepwd?email=' +
          email +
          '">Click to Reset</a> '
      );
      req.session.msg = "Check Mail to reset Password";
      res.redirect("/");
    }
  });
});
