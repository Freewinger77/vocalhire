"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface PrivatePageContainerProps {
  children: React.ReactNode;
}

export function PrivatePageContainer({ children }: PrivatePageContainerProps) {
  const { isLoaded, userId, isSignedIn } = useAuth();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (isLoaded) {
      if (!isSignedIn) {
        router.push("/sign-in");
      } else {
        setIsAuthorized(true);
      }
    }
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Checking authentication...</div>
      </div>
    );
  }

  return <>{children}</>;
} 