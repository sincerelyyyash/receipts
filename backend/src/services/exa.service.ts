import Exa from "exa-js";

const getExaClient = () => {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    throw new Error("EXA_API_KEY is not configured");
  }
  return new Exa(apiKey);
};

interface SearchResult {
  title: string;
  url: string;
  text: string;
  publishedDate?: string;
}

// Search for market outcome data related to a prediction
export const searchMarketOutcome = async (
  predictionText: string,
  predictionDate: Date,
  targetDate?: Date
): Promise<{ results: SearchResult[]; combinedText: string }> => {
  const exa = getExaClient();

  // Calculate search date range
  // Search from prediction date to either target date or 6 months after
  const searchEndDate = targetDate || new Date(predictionDate);
  if (!targetDate) {
    searchEndDate.setMonth(searchEndDate.getMonth() + 6);
  }

  // Ensure we don't search into the future
  const now = new Date();
  const endDate = searchEndDate > now ? now : searchEndDate;

  // Extract key terms from prediction for better search
  const searchQuery = buildSearchQuery(predictionText);

  try {
    const response = await exa.searchAndContents(searchQuery, {
      type: "auto",
      useAutoprompt: true,
      numResults: 5,
      startPublishedDate: predictionDate.toISOString().split("T")[0],
      endPublishedDate: endDate.toISOString().split("T")[0],
      text: {
        maxCharacters: 1000,
      },
    });

    const results: SearchResult[] = response.results.map((r) => ({
      title: r.title || "Untitled",
      url: r.url,
      text: r.text || "",
      publishedDate: r.publishedDate,
    }));

    // Combine all text for analysis
    const combinedText = results
      .map((r) => `[${r.title}] (${r.publishedDate || "Unknown date"})\n${r.text}`)
      .join("\n\n---\n\n");

    return { results, combinedText };
  } catch (error) {
    console.error("Exa search error:", error);
    return { results: [], combinedText: "" };
  }
};

// Build optimized search query from prediction text
const buildSearchQuery = (predictionText: string): string => {
  // Common Indian market terms to look for
  const marketTerms = [
    "nifty",
    "sensex",
    "nse",
    "bse",
    "stock market india",
    "indian market",
    "rbi",
    "interest rate india",
    "inflation india",
    "rupee",
    "inr",
  ];

  // Check if prediction contains any market terms
  const lowerPrediction = predictionText.toLowerCase();
  const foundTerms = marketTerms.filter((term) =>
    lowerPrediction.includes(term)
  );

  // Extract potential stock names (capitalized words that might be tickers)
  const stockPattern = /\b([A-Z]{2,})\b/g;
  const potentialStocks = predictionText.match(stockPattern) || [];

  // Build search query
  let query = predictionText.slice(0, 200); // Take first 200 chars of prediction

  // Add context for Indian market if not already present
  if (foundTerms.length === 0 && potentialStocks.length > 0) {
    query += " india stock market";
  }

  return query;
};

// Search for specific stock performance
export const searchStockPerformance = async (
  stockName: string,
  fromDate: Date,
  toDate: Date
): Promise<{ results: SearchResult[]; combinedText: string }> => {
  const exa = getExaClient();

  const searchQuery = `${stockName} stock price performance`;

  try {
    const response = await exa.searchAndContents(searchQuery, {
      type: "auto",
      useAutoprompt: true,
      numResults: 5,
      startPublishedDate: fromDate.toISOString().split("T")[0],
      endPublishedDate: toDate.toISOString().split("T")[0],
      text: {
        maxCharacters: 800,
      },
    });

    const results: SearchResult[] = response.results.map((r) => ({
      title: r.title || "Untitled",
      url: r.url,
      text: r.text || "",
      publishedDate: r.publishedDate,
    }));

    const combinedText = results
      .map((r) => `[${r.title}]\n${r.text}`)
      .join("\n\n---\n\n");

    return { results, combinedText };
  } catch (error) {
    console.error("Exa stock search error:", error);
    return { results: [], combinedText: "" };
  }
};

// Search for macro economic data
export const searchMacroData = async (
  topic: string,
  fromDate: Date,
  toDate: Date
): Promise<{ results: SearchResult[]; combinedText: string }> => {
  const exa = getExaClient();

  // Map common topics to better search queries
  const topicQueries: Record<string, string> = {
    "interest rate": "RBI interest rate decision india",
    inflation: "india inflation rate cpi",
    gdp: "india gdp growth rate",
    rupee: "indian rupee exchange rate usd",
    market: "indian stock market performance nifty sensex",
  };

  const searchQuery = topicQueries[topic.toLowerCase()] || `${topic} india economy`;

  try {
    const response = await exa.searchAndContents(searchQuery, {
      type: "auto",
      useAutoprompt: true,
      numResults: 5,
      startPublishedDate: fromDate.toISOString().split("T")[0],
      endPublishedDate: toDate.toISOString().split("T")[0],
      text: {
        maxCharacters: 800,
      },
    });

    const results: SearchResult[] = response.results.map((r) => ({
      title: r.title || "Untitled",
      url: r.url,
      text: r.text || "",
      publishedDate: r.publishedDate,
    }));

    const combinedText = results
      .map((r) => `[${r.title}]\n${r.text}`)
      .join("\n\n---\n\n");

    return { results, combinedText };
  } catch (error) {
    console.error("Exa macro search error:", error);
    return { results: [], combinedText: "" };
  }
};

// General purpose search for verification
export const searchForVerification = async (
  query: string,
  afterDate: Date
): Promise<{ results: SearchResult[]; combinedText: string; sources: string[] }> => {
  const exa = getExaClient();

  try {
    const response = await exa.searchAndContents(query, {
      type: "auto",
      useAutoprompt: true,
      numResults: 5,
      startPublishedDate: afterDate.toISOString().split("T")[0],
      text: {
        maxCharacters: 1000,
      },
    });

    const results: SearchResult[] = response.results.map((r) => ({
      title: r.title || "Untitled",
      url: r.url,
      text: r.text || "",
      publishedDate: r.publishedDate,
    }));

    const sources = results.map((r) => r.url);

    const combinedText = results
      .map((r) => `[${r.title}] (${r.publishedDate || "Unknown date"})\n${r.text}`)
      .join("\n\n---\n\n");

    return { results, combinedText, sources };
  } catch (error) {
    console.error("Exa verification search error:", error);
    return { results: [], combinedText: "", sources: [] };
  }
};

