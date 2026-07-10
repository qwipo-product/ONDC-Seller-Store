import { useRouteError, isRouteErrorResponse } from "react-router";
import { usePostHog } from "@posthog/react";

export function RootErrorBoundary() {
  const error = useRouteError();
  const posthog = usePostHog();

  if (error) {
    posthog?.captureException(error instanceof Error ? error : new Error(String(error)));
  }

  if (isRouteErrorResponse(error)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {error.status} {error.statusText}
          </h1>
          <p className="text-gray-500">{error.data}</p>
        </div>
      </div>
    );
  }

  if (error instanceof Error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
          <p className="text-gray-500">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <h1 className="text-2xl font-bold text-gray-900">Unknown Error</h1>
    </div>
  );
}
