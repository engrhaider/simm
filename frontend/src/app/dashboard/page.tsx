"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

// Define a type for the Facebook post structure on the frontend
// This should ideally match or be a subset of backend.schemas.facebook.FacebookPost
interface FrontendFacebookPost {
    id: string;
    message?: string;
    story?: string;
    created_time: string; // Keep as string for display, or parse to Date
    permalink_url?: string;
    full_picture?: string;
    attachments?: {
        data: Array<{
            description?: string;
            media?: {
                image?: {
                    src?: string;
                };
            };
            title?: string;
            type?: string;
            url?: string;
        }>;
    };
    // Add other fields you expect from your backend schema
}

export default function DashboardPage() {
    const { isAuthenticated, user, isLoading, logout, token } = useAuth();
    const router = useRouter();
    const [fbPosts, setFbPosts] = useState<FrontendFacebookPost[]>([]);
    const [fbPostsLoading, setFbPostsLoading] = useState(false);
    const [fbPostsError, setFbPostsError] = useState<string | null>(null);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.replace("/");
        }
    }, [isLoading, isAuthenticated, router]);

    const handleFetchFbPosts = useCallback(async (isLoadMore: boolean = false) => {
        if (!token) {
            setFbPostsError("Authentication token not found. Please log in again.");
            return;
        }
        
        if (isLoadMore) {
            setLoadingMore(true);
        } else {
            setFbPostsLoading(true);
            setFbPostsError(null);
            setFbPosts([]); // Clear previous posts only for initial load
            setNextCursor(null);
            setHasNextPage(false);
        }

        try {
            // Build URL with pagination parameters
            const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/facebook/posts`);
            url.searchParams.append('limit', '5');
            if (isLoadMore && nextCursor) {
                url.searchParams.append('after', nextCursor);
            }

            const response = await fetch(url.toString(), {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: response.statusText }));
                throw new Error(`Failed to fetch Facebook posts: ${errorData.detail || response.statusText} (Status: ${response.status})`);
            }

            const responseData = await response.json();
            const posts: FrontendFacebookPost[] = responseData.data || [];
            const hasNext = responseData.has_next_page || false;
            const nextCur = responseData.next_cursor || null;

            if (isLoadMore) {
                // Append new posts to existing ones
                setFbPosts(prevPosts => [...prevPosts, ...posts]);
            } else {
                // Set initial posts
                setFbPosts(posts);
                if (posts.length === 0) {
                    setFbPostsError("No Facebook posts found. Make sure you have granted 'user_posts' permission or have recent posts.");
                }
            }
            
            setHasNextPage(hasNext);
            setNextCursor(nextCur);
        } catch (error: unknown) {
            console.error("Error fetching Facebook posts:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred while fetching posts.";
            setFbPostsError(errorMessage);
        }
        
        if (isLoadMore) {
            setLoadingMore(false);
        } else {
            setFbPostsLoading(false);
        }
    }, [token, nextCursor, setFbPostsLoading, setFbPostsError, setFbPosts, setHasNextPage, setNextCursor, setLoadingMore]);

    // Auto-load posts when user is authenticated
    useEffect(() => {
        if (!isLoading && isAuthenticated && token) {
            handleFetchFbPosts(false);
        }
    }, [isLoading, isAuthenticated, token, handleFetchFbPosts]);

    const handleLoadMorePosts = () => {
        handleFetchFbPosts(true);
    };



    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <p className="text-xl">Loading dashboard...</p>
            </div>
        );
    }

    if (!isAuthenticated || !user) {
        // This should ideally not be reached if the useEffect hook works correctly
        // but serves as a fallback.
        return (
            <div className="flex min-h-screen items-center justify-center">
                <p className="text-xl">Redirecting to login...</p>
            </div>
        );
    }



    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-8">
            <header className="bg-white shadow p-4 rounded-lg mb-8">
                <div className="container mx-auto flex flex-wrap justify-between items-center">
                    <h1 className="text-xl md:text-2xl font-semibold text-gray-800 mb-2 md:mb-0">Dashboard</h1>
                    <div className="flex items-center space-x-2 md:space-x-4">
                        {user.picture && (
                            <img src={user.picture} alt={user.name || "User"} className="w-8 h-8 md:w-10 md:h-10 rounded-full" />
                        )}
                        <span className="text-sm md:text-base text-gray-700">Welcome, {user.name}!</span>
                        <Link href="/sentiment-analysis" className="px-3 py-1 md:px-4 md:py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition duration-150 text-sm md:text-base">
                            Sentiment Analysis
                        </Link>
                        <button 
                            onClick={logout} 
                            className="px-3 py-1 md:px-4 md:py-2 bg-red-500 text-white rounded hover:bg-red-600 transition duration-150 text-sm md:text-base"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="container mx-auto">
                <div className="bg-white p-4 md:p-6 rounded-lg shadow">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg md:text-xl font-semibold text-gray-700">Your Facebook Posts</h2>
                        {fbPostsLoading && (
                            <div className="text-sm text-gray-500">Loading...</div>
                        )}
                    </div>
                        
                    {fbPostsError && (
                        <p className="mb-4 text-red-600 bg-red-100 p-3 rounded">Error: {fbPostsError}</p>
                    )}
                    
                    <div className="space-y-4 pr-2">
                            {fbPosts.length > 0 && fbPosts.map(post => (
                                <div key={post.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <p className="text-xs text-gray-500">
                                            {new Date(post.created_time).toLocaleString()}
                                        </p>
                                        <div className="flex space-x-2 text-xs">
                                            {post.permalink_url && (
                                                <a href={post.permalink_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                                                    View on Facebook
                                                </a>
                                            )}
                                            <Link 
                                                href={{
                                                    pathname: `/post/${post.id}`,
                                                    query: { postData: JSON.stringify(post) }
                                                }}
                                                className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                                            >
                                                <span title="View Post detail to perform sentiment analysis on comments">View Post</span>
                                            </Link>
                                
                                        </div>
                                    </div>
                                    {post.story && <p className="text-sm text-gray-700 italic mb-2">{post.story}</p>}
                                    {post.message && (
                                        <div className="text-sm text-gray-800 mb-2 whitespace-pre-wrap">
                                            {post.message.length > 200 ? (
                                                <>
                                                    {post.message.substring(0, 200)}...
                                                    <Link 
                                                        href={{
                                                            pathname: `/post/${post.id}`,
                                                            query: { postData: JSON.stringify(post) }
                                                        }}
                                                        className="text-blue-600 hover:text-blue-800 ml-1 font-medium"
                                                    >
                                                        Read more
                                                    </Link>
                                                </>
                                            ) : (
                                                post.message
                                            )}
                                        </div>
                                    )}
                                    {post.full_picture && (
                                        <Link href={{
                                            pathname: `/post/${post.id}`,
                                            query: { postData: JSON.stringify(post) }
                                        }}>
                                            <img src={post.full_picture} alt="Post image" className="my-2 rounded max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity" />
                                        </Link>
                                    )}
                                </div>
                            ))}
                            {!fbPostsLoading && fbPosts.length === 0 && !fbPostsError && (
                                <p className="text-gray-600 text-center py-8">No Facebook posts found. Make sure you&apos;ve granted the &apos;user_posts&apos; permission or have recent posts.</p>
                            )}
                        </div>
                        
                        {/* Load More Button */}
                        {fbPosts.length > 0 && hasNextPage && (
                            <div className="mt-4 text-center">
                                <button 
                                    onClick={handleLoadMorePosts}
                                    disabled={loadingMore}
                                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition duration-150 disabled:bg-gray-400 text-sm"
                                >
                                    {loadingMore ? 'Loading More...' : 'Load More Posts'}
                                </button>
                            </div>
                        )}
                        
                        {/* Posts count info */}
                        {fbPosts.length > 0 && (
                            <div className="mt-2 text-center text-xs text-gray-500">
                                Showing {fbPosts.length} posts{hasNextPage ? ' (more available)' : ' (all loaded)'}
                            </div>
                        )}
                </div>

            </main>
        </div>
    );
} 