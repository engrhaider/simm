"use client";

import { useState, useRef } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, PieLabelRenderProps, LegendPayload } from 'recharts';

interface Results {
  comments: string[];
  predictions: string[];
  image_urls: string[][];
  percentage_positive: number;
  percentage_negative: number;
  percentage_neutral: number;
}

export default function SentimentAnalysisPage() {
  const [comments, setComments] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'positive' | 'negative' | 'neutral'>('all');
  const resultsRef = useRef<HTMLDivElement>(null);

  // Function to clean Facebook/Instagram copied text
  const cleanCommentsText = (text: string): string => {
    if (!text) return text;

    // first pass: replace likes, like reply with delimiter
    text = text.replace(/(likes?\s*)?Reply/g, '<==>');
    // second pass remove the character smdhwy and number <==>
    text = text.replace(/[hsmdwy]\s*\d+\s*<==>/g, '<==>');
    // third pass remove the day posted counter
    text = text.replace(/(\d+) (?:hsmdwy)<==>/g, '<==>');
    return text;
  };

  // Handle paste event to auto-clean text
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const cleanedText = cleanCommentsText(pastedText);
    const currentText = comments;
    const newText = currentText ? currentText + '\n' + cleanedText : cleanedText;
    setComments(newText);
  };

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
      
      // Scroll to results section after setting results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ 
          behavior: 'smooth',
          block: 'start'
        });
      }, 100);
    } catch (error) {
      console.error(error);
      // Handle error display to the user
    } finally {
      setIsLoading(false);
    }
  };

  // Prepare data for pie chart
  const chartData = results ? [
    { name: 'Positive', value: results.percentage_positive, color: '#10B981' },
    { name: 'Negative', value: results.percentage_negative, color: '#EF4444' },
    { name: 'Neutral', value: results.percentage_neutral, color: '#6B7280' }
  ] : [];

  // Get sentiment color
  const getSentimentColor = (sentiment: string) => {
    switch (sentiment.toLowerCase()) {
      case 'positive':
        return '#10B981'; // green
      case 'negative':
        return '#EF4444'; // red
      case 'neutral':
        return '#6B7280'; // gray
      default:
        return '#6B7280';
    }
  };

  // Get sentiment emoji
  const getSentimentEmoji = (sentiment: string) => {
    switch (sentiment.toLowerCase()) {
      case 'positive':
        return '😊';
      case 'negative':
        return '😞';
      case 'neutral':
        return '😐';
      default:
        return '❓';
    }
  };

  // Filter comments based on selected sentiment
  const filteredComments = results ? 
    results.comments.map((comment, index) => ({
      comment,
      prediction: results.predictions[index],
      imageUrls: results.image_urls[index] || [],
      index
    })).filter(item => 
      selectedFilter === 'all' || item.prediction.toLowerCase() === selectedFilter
    ) : [];

  // Custom label function for pie chart
  const renderCustomizedLabel = (props: PieLabelRenderProps) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
    
    if (typeof cx !== 'number' || typeof cy !== 'number' || typeof midAngle !== 'number' || 
        typeof innerRadius !== 'number' || typeof outerRadius !== 'number' || typeof percent !== 'number') {
      return null;
    }

    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        className="font-bold"
      >
        {`${(percent * 100).toFixed(1)}%`}
      </text>
    );
  };

  // Image component with error handling
  const ImageWithErrorHandling = ({ src, alt }: { src: string; alt: string }) => {
    const [imageError, setImageError] = useState(false);
    const [imageLoading, setImageLoading] = useState(true);

    return (
      <div className="relative mt-2">
        {!imageError ? (
          <>
            {imageLoading && (
              <div className="w-full h-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse flex items-center justify-center">
                <span className="text-gray-500 dark:text-gray-400">Loading...</span>
              </div>
            )}
            <img
              src={src}
              alt={alt}
              className={`max-w-full h-auto rounded-lg border border-gray-200 dark:border-gray-600 ${
                imageLoading ? 'hidden' : 'block'
              }`}
              style={{ maxHeight: '200px' }}
              onLoad={() => setImageLoading(false)}
              onError={() => {
                setImageError(true);
                setImageLoading(false);
              }}
            />
          </>
        ) : (
          <div className="w-full p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-600 dark:text-red-400 text-sm">
              Failed to load image: <span className="font-mono text-xs break-all">{src}</span>
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 py-8">
      <div className="w-full max-w-6xl mx-auto p-8 space-y-8">
        {/* Input Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-center mb-8">
            Multimodal Sentiment Analysis - understand your audience
          </h1>
          <p className="text-sm text-gray-500  mb-4">Paste your Social media (Facebook/Instagram/Tiktok) post comments here or enter the comments manually separated by <span className="bg-gray-200 dark:bg-gray-700 rounded-md px-2 py-1 text-sm">&#x3C;==&#x3E;</span> delimiter to perform sentiment analysis. You can enter images urls in comments to perform multimodal sentiment analysis.</p>
          <textarea
            className="w-full h-64 p-4 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-base focus:ring-2 focus:ring-blue-500"
            placeholder="Enter your comments here..."
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            onPaste={handlePaste}
          />
          <button
            onClick={handleAnalyze}
            className="w-full mt-4 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md disabled:bg-gray-400"
            disabled={isLoading || !comments.trim()}
          >
            {isLoading ? "Analyzing..." : "Analyze"}
          </button>
        </div>

        {/* Results Section */}
        {results && (
          <div ref={resultsRef} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Chart Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-2xl font-semibold mb-6 text-center">
                Sentiment Distribution
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                The pie chart shows percentage of comments that are positive, negative, or neutral.
              </p>
              <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={renderCustomizedLabel}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number, name: string) => [`${value.toFixed(2)}%`, name]}
                      contentStyle={{
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#ffffff'
                      }}
                      labelStyle={{
                        color: '#ffffff'
                      }}
                      itemStyle={{
                        color: '#ffffff'
                      }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                      formatter={(value, entry: LegendPayload) => {
                        const payload = entry.payload as { value: number } | undefined;
                        return (
                          <span style={{ color: entry.color || '#000', fontWeight: 'bold' }}>
                            {value}: {(payload?.value || 0).toFixed(2)}%
                          </span>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
            </div>

            {/* Comments Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-semibold">
                  Comments Analysis
                </h2>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {filteredComments.length} of {results.comments.length} comments
                </div>
              </div>
              
              {/* Filter buttons */}
              <div className="flex flex-wrap gap-2 mb-4">
                {(['all', 'positive', 'negative', 'neutral'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setSelectedFilter(filter)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      selectedFilter === filter
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                    {filter !== 'all' && (
                      <span className="ml-1">
                        {results.predictions.filter(p => p.toLowerCase() === filter).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Comments list */}
              <div className="max-h-96 overflow-y-auto space-y-3">
                {filteredComments.length === 0 ? (
                  <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                    No comments found for the selected filter.
                  </div>
                ) : (
                  filteredComments.map((item, index) => (
                    <div
                      key={`${item.index}-${index}`}
                      className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg"
                      style={{
                        borderLeftWidth: '4px',
                        borderLeftColor: getSentimentColor(item.prediction)
                      }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-xl">
                            {getSentimentEmoji(item.prediction)}
                          </span>
                          <span
                            className="px-2 py-1 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: getSentimentColor(item.prediction) + '20',
                              color: getSentimentColor(item.prediction)
                            }}
                          >
                            {item.prediction.charAt(0).toUpperCase() + item.prediction.slice(1)}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          #{item.index + 1}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                        {item.comment}
                      </p>
                      
                      {/* Display images if any */}
                      {item.imageUrls && item.imageUrls.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                            Images found in comment:
                          </p>
                          {item.imageUrls.map((imageUrl, imgIndex) => (
                            <ImageWithErrorHandling
                              key={`${item.index}-${imgIndex}`}
                              src={imageUrl}
                              alt={`Comment ${item.index + 1} image ${imgIndex + 1}`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

