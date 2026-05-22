export type PushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
};

export async function sendPushNotification(msg: PushMessage): Promise<void> {
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(msg),
    });
  } catch {
    // Best-effort — never throw
  }
}

export async function sendPushToUser(
  token: string | null | undefined,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  if (!token) return;
  await sendPushNotification({ to: token, title, body, data });
}
