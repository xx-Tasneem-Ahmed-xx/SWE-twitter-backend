import { Worker } from "bullmq";

// background redis


// job type
import type { EmailJobData } from "../types/jobs";

// GLOBAL project secrets


import { loadSecrets, getSecrets } from "../../config/secrets";
import { initRedis } from "../../config/redis";
import { bullRedisConfig } from "../config/redis";


import nodemailer from "nodemailer";

async function startWorker() {
  console.log(" [emails.worker] Starting email worker...");

  await initRedis();
  console.log(" [emails.worker] Redis initialized");

  await loadSecrets();
  console.log(" [emails.worker] Secrets loaded");

  const { Mail_email, Mail_password } = getSecrets();
  console.log(" [emails.worker] Email credentials loaded:", Mail_email);

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: Mail_email,
      pass: Mail_password,
    },
  });

  console.log(" [emails.worker] Transporter created");

  const emailWorker = new Worker<EmailJobData>(
    "emails",
    async (job) => {
      console.log(" [emails.worker] Processing job:", job.id, "to:", job.data.to);

      const { to, subject, message, templateType } = job.data;

      try {
        const mailOptions = {
          from: Mail_email,
          to,
          subject,
          text: message,
        };

        console.log(" [emails.worker] Sending email...");
        await transporter.sendMail(mailOptions);

        console.log(
          ` [emails.worker] Email sent! Job: ${job.name}, ID: ${job.id}, To: ${to}, Template: ${templateType}`
        );

        return { success: true, to, templateType };
      } catch (error) {
        console.error(` [emails.worker] Failed to send email to ${to}:`, error);
        throw error;
      }
    },
    {
      connection: bullRedisConfig,
      concurrency: 5,
    }
  );

  emailWorker.on("completed", (job) => {
    console.log(` [emails.worker] Job completed: ${job.name}, ID: ${job.id}, To: ${job.data.to}`);
  });

  emailWorker.on("failed", (job, err) => {
    console.error(` [emails.worker] Job failed: ${job?.id}`, err);
  });

  emailWorker.on("error", (err) => {
    console.error(" [emails.worker] Worker error:", err);
  });

  console.log(" [emails.worker] Email worker started successfully and waiting for jobs");
}

startWorker().catch((err) => {
  console.error(" [emails.worker] Failed to start:", err);
  process.exit(1);
});
