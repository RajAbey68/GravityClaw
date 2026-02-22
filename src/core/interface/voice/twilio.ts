export class TwilioAdapter {
  constructor(
    private readonly accountSid?: string,
    private readonly authToken?: string,
    private readonly fromNumber?: string
  ) {}

  get available() {
    return Boolean(this.accountSid && this.authToken && this.fromNumber);
  }

  async createOutboundCall(toNumber: string, twimlUrl: string) {
    if (!this.available) {
      return { ok: false as const, reason: "twilio-not-configured" };
    }

    const body = new URLSearchParams({
      To: toNumber,
      From: this.fromNumber as string,
      Url: twimlUrl
    });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Calls.json`,
      {
        method: "POST",
        headers: {
          authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`,
          "content-type": "application/x-www-form-urlencoded"
        },
        body
      }
    );

    if (!response.ok) {
      return { ok: false as const, reason: "twilio-call-failed" };
    }

    const payload = (await response.json()) as { sid?: string };
    return { ok: true as const, sid: payload.sid ?? "unknown" };
  }
}
