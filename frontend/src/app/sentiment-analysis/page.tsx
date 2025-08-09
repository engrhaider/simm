"use client";

import { useState } from "react";

interface Results {
  positive: number;
  negative: number;
  neutral: number;
}

export default function SentimentAnalysisPage() {
  const [comments, setComments] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleAnalyze = async () => {
    setIsLoading(true);
    setResults(null);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/sentiment/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ comments }),
      });
      if (!response.ok) {
        throw new Error('Failed to analyze sentiments');
      }
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error(error);
      // Handle error display to the user
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col items-center justify-center">
      <div className="w-full max-w-2xl mx-auto p-8 space-y-8 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-center">
          Manual Sentiment Analysis
        </h1>
        <p className="text-center text-gray-600 dark:text-gray-400">
          Enter comments separated by new lines to analyze their sentiment.
        </p>
        <textarea
          className="w-full h-64 p-4 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-base focus:ring-2 focus:ring-blue-500"
          placeholder="Enter comments here..."
          value={comments}
          onChange={(e) => setComments(e.target.value)}
        />
        <button
          onClick={handleAnalyze}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md disabled:bg-gray-400"
          disabled={isLoading || !comments.trim()}
        >
          {isLoading ? "Analyzing..." : "Analyze"}
        </button>
        {results && (
          <div className="p-6 bg-gray-50 dark:bg-gray-700 rounded-md">
            <h2 className="text-2xl font-semibold mb-4 text-center">
              Analysis Results
            </h2>
            <div className="flex justify-around items-center">
              <div className="text-center">
                <p className="text-lg font-medium text-green-500">Positive</p>
                <p className="text-2xl font-bold">
                  {results.positive.toFixed(2)}%
                </p>
              </div>
              <div className="text-center">
                <p className="text-lg font-medium text-red-500">Negative</p>
                <p className="text-2xl font-bold">
                  {results.negative.toFixed(2)}%
                </p>
              </div>
              <div className="text-center">
                <p className="text-lg font-medium text-gray-500">Neutral</p>
                <p className="text-2xl font-bold">
                  {results.neutral.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

