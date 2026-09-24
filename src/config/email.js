import nodemailer from 'nodemailer';
import { env } from './env.js';

export const transporter = nodemailer.createTransport({
  host: env.smtpHost,
  port: env.smtpPort,
  secure: false,
  // Bounded waits: a blackholed SMTP host must never hang registration,
  // checkout emails or password resets indefinitely.
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
  auth: {
    user: env.smtpUser,
    pass: env.smtpPassword,
  },
});

export const emailConfig = {
  from: env.emailFrom,
};
