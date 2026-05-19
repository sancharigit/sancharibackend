import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const mailHost = process.env.MAIL_HOST || 'smtp.gmail.com';
const mailPort = parseInt(process.env.MAIL_PORT) || 587;
const mailSecure = process.env.MAIL_ENCRYPTION === 'ssl' || mailPort === 465;
const mailUser = process.env.MAIL_USERNAME || 'shubham.dubeyargos@gmail.com';
const mailPass = process.env.MAIL_PASSWORD ? process.env.MAIL_PASSWORD.replace(/"/g, '') : '';
const mailFrom = process.env.MAIL_FROM_ADDRESS ? process.env.MAIL_FROM_ADDRESS.replace(/"/g, '') : mailUser;

const transporter = nodemailer.createTransport({
    host: mailHost,
    port: mailPort,
    secure: mailSecure,
    auth: {
        user: mailUser,
        pass: mailPass
    }
});

/**
 * Send an email
 * @param {object} options - Email options (to, subject, text, html)
 * @returns {Promise<any>}
 */
export const sendEmail = async (options) => {
    try {
        const mailOptions = {
            from: `"Sanchari Support" <${mailFrom}>`,
            to: options.to,
            subject: options.subject,
            text: options.text,
            html: options.html
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', info.messageId);
        return info;
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};
