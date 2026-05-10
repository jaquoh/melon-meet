import type { AppBindings } from "../types/env";

interface SendEmailInput {
  html: string;
  replyTo?: string | null;
  subject: string;
  text: string;
  to: string | string[];
}

export async function sendResendEmail(env: AppBindings, input: SendEmailInput) {
  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({
      from: env.EMAIL_FROM_ADDRESS,
      html: input.html,
      replyTo: input.replyTo ?? env.EMAIL_REPLY_TO_ADDRESS,
      subject: input.subject,
      text: input.text,
      to: input.to,
    }),
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "User-Agent": `${env.APP_NAME}/transactional-mail`,
    },
    method: "POST",
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Resend email send failed", {
      body: errorBody,
      status: response.status,
      statusText: response.statusText,
    });
    throw new Error("Email delivery failed.");
  }

  return response.json<{ id: string }>();
}
