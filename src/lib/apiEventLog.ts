import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function logApiEvent(params: {
  route: string;
  client_id?: string;
  ok?: boolean;
  debug_id?: string;
  status_code?: number;
  request?: any;
  response?: any;
}) {
  try {
    await supabaseAdmin.from("api_event_logs").insert({
      route: params.route,
      client_id: params.client_id || null,
      ok: typeof params.ok === "boolean" ? params.ok : null,
      debug_id: params.debug_id || null,
      status_code: params.status_code ?? null,
      request: params.request ?? null,
      response: params.response ?? null,
    });
  } catch {
    // Never block core flow on logging.
  }
}
