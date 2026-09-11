import { NextRequest, NextResponse } from "next/server";

const CORRELATION_ID_HEADER = "x-request-id";

function generateRequestId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 32);
}

export function correlationIdMiddleware(request: NextRequest) {
  let requestId = request.headers.get(CORRELATION_ID_HEADER);
  if (!requestId) {
    requestId = generateRequestId();
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CORRELATION_ID_HEADER, requestId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(CORRELATION_ID_HEADER, requestId);

  return response;
}

export { CORRELATION_ID_HEADER };

export function getRequestId(request: Request) {
  return request.headers.get(CORRELATION_ID_HEADER);
}

export { generateRequestId };
