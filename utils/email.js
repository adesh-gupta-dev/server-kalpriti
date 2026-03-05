import nodemailer from "nodemailer";
import { config } from "../config/index.js";

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      service: config.smtp.service,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.password,
      },
    });
  }
  return transporter;
}

export async function sendEmail(to, subject, html) {
  const mailOptions = {
    from: config.smtp.from,
    to,
    subject,
    html,
  };
  await getTransporter().sendMail(mailOptions);
}
