"use client";

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const { isAuthenticated, user, logout, isLoading } = useAuth();
  const router = useRouter();

  const handleLogin = () => {
    // The backend URL that starts the Facebook OAuth flow
    // Ensure your backend is running and accessible at this address
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/login/facebook`;
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-100">
        <div className="text-2xl font-semibold text-gray-700">Loading...</div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-6">Welcome!</h1>
        {isAuthenticated && user ? (
          <div className="space-y-4">
            <p className="text-xl text-gray-700">Hello, {user.name || 'User'}!</p>
            {user.picture && (
              <img src={user.picture} alt={user.name || 'User profile'} className="w-24 h-24 rounded-full mx-auto" />
            )}
            <p className="text-gray-600">You are logged in.</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-4 px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700 transition duration-150"
            >
              Go to Dashboard
            </button>
            <button
              onClick={logout}
              className="mt-4 ml-4 px-6 py-2 bg-red-500 text-white font-semibold rounded-lg shadow hover:bg-red-600 transition duration-150"
            >
              Logout
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xl text-gray-700">Please log in to continue.</p>
            <button
              onClick={handleLogin}
              className="mt-4 px-8 py-3 bg-blue-600 text-white font-bold rounded-lg shadow-lg hover:bg-blue-700 transition duration-150 text-lg"
            >
              Login with Facebook
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
