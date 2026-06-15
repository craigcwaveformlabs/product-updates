import { NextRequest, NextResponse } from "next/server";

function unauthorizedResponse() {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Content Studio"',
    },
  });
}

export function proxy(request: NextRequest) {
  const username = process.env.CONTENT_STUDIO_USERNAME;
  const password = process.env.CONTENT_STUDIO_PASSWORD;
  const isDevelopment = process.env.NODE_ENV !== "production";

  if (!username || !password) {
    if (isDevelopment) {
      return NextResponse.next();
    }

    return new NextResponse("Not found.", { status: 404 });
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) {
    return unauthorizedResponse();
  }

  const encodedCredentials = authorization.slice(6);

  try {
    const decodedCredentials = atob(encodedCredentials);
    const separatorIndex = decodedCredentials.indexOf(":");
    const providedUsername = separatorIndex >= 0 ? decodedCredentials.slice(0, separatorIndex) : decodedCredentials;
    const providedPassword = separatorIndex >= 0 ? decodedCredentials.slice(separatorIndex + 1) : "";

    if (providedUsername === username && providedPassword === password) {
      return NextResponse.next();
    }
  } catch {
    return unauthorizedResponse();
  }

  return unauthorizedResponse();
}

export const config = {
  matcher: ["/content-studio/:path*", "/api/content/:path*"],
};
