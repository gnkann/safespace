/** Абстракція відправника пошти (SendGrid / Nodemailer / консоль у dev). */
export interface EmailSender {
  send(to: string, subject: string, body: string): Promise<void>;
}
