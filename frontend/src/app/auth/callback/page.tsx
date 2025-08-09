"use client";

import { useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

function AuthCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { login, isAuthenticated, isLoading, token: authTokenFromContext } = useAuth();
    const loginAttempted = useRef(false);

    useEffect(() => {
        const tokenFromUrl = searchParams.get('token');

        if (tokenFromUrl && !isAuthenticated && !authTokenFromContext && !loginAttempted.current) {
            console.log("Token found in URL, attempting login...");
            loginAttempted.current = true;
            login(tokenFromUrl);
        } else if (!tokenFromUrl && !isLoading && !isAuthenticated) {
            console.warn("No token in URL and not authenticated, redirecting to home.");
            router.replace('/');
        }
    }, [searchParams, login, isAuthenticated, isLoading, router, authTokenFromContext]);

    useEffect(() => {
        if (!isLoading) {
            if (isAuthenticated) {
                console.log("Authenticated, redirecting to dashboard...");
                router.replace('/dashboard');
            } else if (!searchParams.get('token')) {
                console.warn("Not authenticated and no token to process, redirecting to home after loading.");
            }
        }
    }, [isAuthenticated, isLoading, router, searchParams]);

    if (isLoading) {
        return <div className="flex min-h-screen items-center justify-center"><p className="text-xl">Loading authentication...</p></div>;
    }

    if (isAuthenticated) {
        return <div className="flex min-h-screen items-center justify-center"><p className="text-xl">Successfully authenticated! Redirecting to dashboard...</p></div>;
    }
    
    if (searchParams.get('token') && !loginAttempted.current) {
        return <div className="flex min-h-screen items-center justify-center"><p className="text-xl">Processing authentication...</p></div>;
    }

    return (
        <div className="flex min-h-screen items-center justify-center flex-col space-y-4">
            <p className="text-xl text-red-600">Authentication processing issue or invalid state.</p>
            <p className="text-md">You might be redirected shortly. If not, please try returning to the homepage.</p>
            <button onClick={() => router.push('/')} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                Go to Homepage
            </button>
        </div>
    );
}

export default function AuthCallbackPage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center">
                <p className="text-xl">Loading...</p>
            </div>
        }>
            <AuthCallbackContent />
        </Suspense>
    );
} 