"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

// Facebook Comment interface based on backend schema
interface FacebookComment {
    id: string;
    message?: string;
    created_time: string;
    from_user?: {
        id: string;
        name: string;
        picture?: string;
    };
    attachment?: {
        type?: string;
        url?: string;
        media?: any;
    };
}

// Facebook Post interface (matching the dashboard interface but more detailed)
interface FacebookPost {
    id: string;
    message?: string;
    story?: string;
    created_time: string;
    permalink_url?: string;
    full_picture?: string;
}

export default function PostDetailPage() {
    const { isAuthenticated, isLoading, token } = useAuth();
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const postId = params?.id as string;

    const [post, setPost] = useState<FacebookPost | null>(null);
    const [comments, setComments] = useState<FacebookComment[]>([]);
    const [loadingPost, setLoadingPost] = useState(true);
    const [loadingComments, setLoadingComments] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.replace("/");
        }
    }, [isLoading, isAuthenticated, router]);

    useEffect(() => {
        if (!isLoading && isAuthenticated && token && postId) {
            // Try to get post data from URL params first
            const postDataParam = searchParams?.get('postData');
            if (postDataParam) {
                try {
                    const postData = JSON.parse(postDataParam);
                    setPost(postData);
                    setLoadingPost(false);
                    // Only fetch comments
                    fetchComments();
                } catch (error) {
                    console.error("Error parsing post data from URL:", error);
                    // Fallback to fetching both post and comments
                    fetchPostAndComments();
                }
            } else {
                // Fallback to fetching both post and comments
                fetchPostAndComments();
            }
        }
    }, [isLoading, isAuthenticated, token, postId, searchParams]);

    const fetchPostAndComments = async () => {
        if (!token || !postId) {
            setError("Missing authentication token or post ID");
            return;
        }

        setLoadingPost(true);
        setError(null);

        try {
            const postResponse = await fetchSinglePost(postId);
            if (postResponse) {
                setPost(postResponse);
            }
            setLoadingPost(false);
            
            // Fetch comments after post is loaded
            await fetchComments();
        } catch (error: any) {
            console.error("Error fetching post and comments:", error);
            setError(error.message || "Failed to load post and comments");
            setLoadingPost(false);
            setLoadingComments(false);
        }
    };

    const fetchSinglePost = async (postId: string): Promise<FacebookPost | null> => {
        try {
            // Try the dedicated single post endpoint first
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/api/v1/facebook/posts/${postId}`,
                {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            if (response.ok) {
                return await response.json();
            }
            
            // If single post endpoint fails, fall back to searching through recent posts
            console.log("Single post endpoint failed, falling back to posts search");
            const fallbackUrl = new URL(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/facebook/posts`);
            fallbackUrl.searchParams.append('limit', '25'); // Reduced limit to avoid data overflow
            
            const fallbackResponse = await fetch(fallbackUrl.toString(), {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });

            if (!fallbackResponse.ok) {
                const errorData = await fallbackResponse.json().catch(() => ({ detail: fallbackResponse.statusText }));
                throw new Error(`Failed to fetch post: ${errorData.detail || fallbackResponse.statusText}`);
            }

            const responseData = await fallbackResponse.json();
            const posts: FacebookPost[] = responseData.data || [];
            return posts.find(p => p.id === postId) || null;
            
        } catch (error: any) {
            console.error("Error in fetchSinglePost:", error);
            throw error;
        }
    };

    const fetchComments = async () => {
        if (!token || !postId) {
            setError("Missing authentication token or post ID");
            return;
        }

        setLoadingComments(true);
        try {
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/api/v1/facebook/posts/${postId}/comments?limit=50`,
                {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: response.statusText }));
                throw new Error(`Failed to fetch comments: ${errorData.detail || response.statusText}`);
            }

            const commentsData = await response.json();
            
            // Fix field mapping: Facebook API returns 'from' but we expect 'from_user'
            const mappedComments = commentsData.map((comment: any) => ({
                ...comment,
                from_user: comment.from || comment.from_user
            }));
            
            setComments(mappedComments);
        } catch (error: any) {
            console.error("Error fetching comments:", error);
            setError(error.message || "Failed to load comments");
        } finally {
            setLoadingComments(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString();
    };

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <p className="text-xl">Loading...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <p className="text-xl">Redirecting to login...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-100 p-4 md:p-8">
                <div className="container mx-auto max-w-4xl">
                    <div className="mb-6">
                        <Link 
                            href="/dashboard" 
                            className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors"
                        >
                            ← Back to Dashboard
                        </Link>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow">
                        <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
                        <p className="text-gray-700">{error}</p>
                        <button 
                            onClick={fetchPostAndComments}
                            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-8">
            <div className="container mx-auto max-w-4xl">
                {/* Navigation */}
                <div className="mb-6">
                    <Link 
                        href="/dashboard" 
                        className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors"
                    >
                        ← Back to Dashboard
                    </Link>
                </div>

                {/* Post Content */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-8">
                    {loadingPost ? (
                        <div className="p-6 text-center">
                            <p className="text-gray-500">Loading post...</p>
                        </div>
                    ) : post ? (
                        <div className="p-6">
                            {/* Post Header */}
                            <div className="mb-4">
                                <div className="flex justify-between items-start mb-2">
                                    <h1 className="text-2xl font-bold text-gray-800">Facebook Post</h1>
                                    {post.permalink_url && (
                                        <a 
                                            href={post.permalink_url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-blue-500 hover:text-blue-700 text-sm underline"
                                        >
                                            View on Facebook
                                        </a>
                                    )}
                                </div>
                                <p className="text-sm text-gray-500">{formatDate(post.created_time)}</p>
                            </div>

                            {/* Post Content */}
                            <div className="space-y-4">
                                {post.story && (
                                    <div className="italic text-gray-700 bg-gray-50 p-3 rounded">
                                        {post.story}
                                    </div>
                                )}
                                
                                {post.message && (
                                    <div className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                                        {post.message}
                                    </div>
                                )}

                                {post.full_picture && (
                                    <div className="mt-4">
                                        <img 
                                            src={post.full_picture} 
                                            alt="Post image" 
                                            className="rounded-lg max-w-full h-auto shadow-md"
                                        />
                                    </div>
                                )}

                            </div>
                        </div>
                    ) : (
                        <div className="p-6 text-center">
                            <h1 className="text-2xl font-bold text-gray-800 mb-2">Post Not Found</h1>
                            <p className="text-gray-600">The requested post could not be found or you don't have permission to view it.</p>
                        </div>
                    )}
                </div>

                {/* Comments Section */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                    <div className="p-6 border-b border-gray-200">
                        <h2 className="text-xl font-semibold text-gray-800">
                            Comments {!loadingComments && `(${comments.length})`}
                        </h2>
                    </div>
                    
                    {loadingComments ? (
                        <div className="p-6 text-center">
                            <p className="text-gray-500">Loading comments...</p>
                        </div>
                    ) : comments.length > 0 ? (
                        <div className="divide-y divide-gray-200">
                            {comments.map((comment) => (
                                <div key={comment.id} className="p-6">
                                    <div className="flex items-start space-x-3">
                                        {comment.from_user?.picture && (
                                            <img 
                                                src={comment.from_user.picture} 
                                                alt={comment.from_user.name || "Commenter"} 
                                                className="w-10 h-10 rounded-full flex-shrink-0"
                                            />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center space-x-2 mb-1">
                                                <h3 className="text-sm font-medium text-gray-900">
                                                    {comment.from_user?.name || "Unknown User"}
                                                </h3>
                                                <span className="text-xs text-gray-500">
                                                    {formatDate(comment.created_time)}
                                                </span>
                                            </div>
                                            
                                            {comment.message && (
                                                <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                                                    {comment.message}
                                                </p>
                                            )}

                                            {comment.attachment && (
                                                <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                                                    <p>Attachment: {comment.attachment.type}</p>
                                                    {comment.attachment.url && (
                                                        <a 
                                                            href={comment.attachment.url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="text-blue-500 hover:text-blue-700 underline"
                                                        >
                                                            View
                                                        </a>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-6 text-center text-gray-500">
                            <p>No comments on this post yet.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
} 