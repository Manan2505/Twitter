const nodemailer = require("nodemailer");
const sendVerifyemail = async (to_mail, sub, content) => {
  let transporter = nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 465,
    auth: {
      user: "arora.manan.k1234@gmail.com",
      pass: "rweetbplkszpzmly",
    },
  });

  let info = await transporter.sendMail({
    to: to_mail,
    from: "arora.manan.k1234@gmail.com",
    subject: sub,
    html: content,
  });
  if (info.messageId) {
    return true;
  } else {
    return false;
  }
};

module.exports = sendVerifyemail;