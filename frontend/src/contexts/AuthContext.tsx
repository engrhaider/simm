"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode'; // Utility to decode JWTs

interface AuthTokenPayload {
    sub: string; // User ID from Facebook
    name?: string;
    email?: string;
    picture?: string;
    fb_access_token: string; // Facebook access token
    exp: number; // Expiry timestamp
}

interface AuthContextType {
    isAuthenticated: boolean;
    user: AuthTokenPayload | null;
    token: string | null;
    login: (token: string) => void;
    logout: () => void;
    isLoading: boolean;
    getFacebookAccessToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [token, setToken] = useState<string | null>(null);
    const [user, setUser] = useState<AuthTokenPayload | null>(null);
    const [isLoading, setIsLoading] = useState(true); // Start with loading true

    useEffect(() => {
        // Try to load token from localStorage on initial mount
        setIsLoading(true);
        const storedToken = localStorage.getItem('app_token');
        if (storedToken) {
            try {
                const decoded = jwtDecode<AuthTokenPayload>(storedToken);
                if (decoded.exp * 1000 > Date.now()) {
                    setToken(storedToken);
                    setUser(decoded);
                } else {
                    // Token expired
                    localStorage.removeItem('app_token');
                }
            } catch (error) {
                console.error("Failed to decode token from storage:", error);
                localStorage.removeItem('app_token');
            }
        }
        setIsLoading(false);
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('app_token');
        setToken(null);
        setUser(null);
        console.log("User logged out, token removed.");
    }, []);

    const login = useCallback((newToken: string) => {
        try {
            const decoded = jwtDecode<AuthTokenPayload>(newToken);
            if (decoded.exp * 1000 > Date.now()) {
                localStorage.setItem('app_token', newToken);
                setToken(newToken);
                setUser(decoded);
                console.log("User logged in, token stored.", decoded);
            } else {
                console.error("Attempted to login with an expired token.");
                logout();
            }
        } catch (error) {
            console.error("Failed to decode token on login:", error);
            logout();
        }
    }, [logout]);

    const getFacebookAccessToken = useCallback(() => {
        if (user && user.fb_access_token) {
            return user.fb_access_token;
        }
        return null;
    }, [user]);

    return (
        <AuthContext.Provider value={{ isAuthenticated: !!token && !!user, user, token, login, logout, isLoading, getFacebookAccessToken }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}; 