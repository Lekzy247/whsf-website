export function GET() {
  return Response.json({ service: "admin", status: "ok", version: "0.1.0", timestamp: new Date().toISOString() });
}
