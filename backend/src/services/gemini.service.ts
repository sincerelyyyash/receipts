import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ExtractedPrediction, PredictionVerification } from "../types/index.ts";

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return new GoogleGenerativeAI(apiKey);
};

// Extract predictions from transcript text
export const extractPredictions = async (
  transcriptText: string,
  videoPublishedAt: Date
): Promise<ExtractedPrediction[]> => {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-05-20" });

  const prompt = `You are an expert financial analyst. Analyze this transcript from a finance YouTube video published on ${videoPublishedAt.toISOString().split("T")[0]}.

Extract all PREDICTIONS and FORECASTS about:
- Stock prices (specific stocks or indices like Nifty, Sensex, specific company stocks)
- Market direction (bullish/bearish predictions)
- Sector performance (IT, banking, pharma, etc.)
- Macroeconomic predictions (interest rates, inflation, GDP growth)
- Currency movements (INR/USD, etc.)
- Specific investment recommendations

For each prediction found, provide:
1. The exact quote or paraphrased prediction
2. The type: "stock", "market", "sector", "macro", or "other"
3. If mentioned, when they expect it to happen (target date)
4. Your confidence that this is actually a prediction (0-100)

IMPORTANT: Only include actual predictions/forecasts, not general advice or educational content.

Transcript:
${transcriptText.slice(0, 15000)}

Respond in this exact JSON format (array of predictions):
[
  {
    "predictionText": "The prediction statement",
    "predictionType": "stock|market|sector|macro|other",
    "targetDate": "YYYY-MM-DD or null if not specified",
    "confidence": 85
  }
]

If no predictions are found, return an empty array: []`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Extract JSON from response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }

    const predictions = JSON.parse(jsonMatch[0]);

    // Add timestamps (we'll approximate based on position in transcript)
    return predictions.map((pred: any, index: number) => ({
      timestampSec: index * 60, // Placeholder - will be refined by analysis service
      timestampFormatted: `${Math.floor(index)}:00`,
      predictionText: pred.predictionText,
      predictionType: pred.predictionType || "other",
      targetDate: pred.targetDate,
      confidence: pred.confidence || 50,
    }));
  } catch (error) {
    console.error("Gemini prediction extraction error:", error);
    return [];
  }
};

// Compare prediction against actual outcome
export const compareOutcome = async (
  predictionText: string,
  predictionDate: Date,
  actualOutcomeData: string,
  searchSources: string[]
): Promise<PredictionVerification> => {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-05-20" });

  const prompt = `You are an expert financial analyst evaluating prediction accuracy.

PREDICTION (made on ${predictionDate.toISOString().split("T")[0]}):
"${predictionText}"

ACTUAL MARKET DATA AND NEWS (from web search):
${actualOutcomeData}

Sources: ${searchSources.join(", ")}

Evaluate how accurate this prediction was:

1. What actually happened in the market related to this prediction?
2. Was the prediction accurate, partially accurate, or inaccurate?
3. Provide a score from 0-100:
   - 90-100: Prediction was highly accurate, got direction and magnitude right
   - 70-89: Prediction was mostly accurate, got the main direction right
   - 50-69: Prediction was partially accurate, some aspects were correct
   - 30-49: Prediction was mostly wrong but had some valid points
   - 0-29: Prediction was completely wrong or opposite happened

Respond in this exact JSON format:
{
  "actualOutcome": "What actually happened in 2-3 sentences",
  "accuracyScore": 75,
  "explanation": "Why this score was given in 2-3 sentences"
}`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        actualOutcome: "Unable to determine outcome",
        accuracyScore: 50,
        explanation: "Could not parse AI response",
        searchSources,
      };
    }

    const verification = JSON.parse(jsonMatch[0]);

    return {
      actualOutcome: verification.actualOutcome,
      accuracyScore: Math.min(100, Math.max(0, verification.accuracyScore)),
      explanation: verification.explanation,
      searchSources,
    };
  } catch (error) {
    console.error("Gemini outcome comparison error:", error);
    return {
      actualOutcome: "Error processing outcome",
      accuracyScore: 50,
      explanation: "An error occurred during analysis",
      searchSources,
    };
  }
};

// Extract predictions with timestamps from segmented transcript
export const extractPredictionsWithTimestamps = async (
  transcriptWindows: { text: string; startTimestamp: string; endTimestamp: string }[],
  videoPublishedAt: Date
): Promise<ExtractedPrediction[]> => {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-05-20" });

  const allPredictions: ExtractedPrediction[] = [];

  // Process in batches to avoid token limits
  const batchSize = 10;
  for (let i = 0; i < transcriptWindows.length; i += batchSize) {
    const batch = transcriptWindows.slice(i, i + batchSize);

    const prompt = `Analyze these transcript segments from a finance YouTube video published on ${videoPublishedAt.toISOString().split("T")[0]}.

For each segment, identify if there's a prediction about stocks, markets, sectors, or macroeconomic factors.

Segments:
${batch
  .map(
    (w, idx) =>
      `[${i + idx}] (${w.startTimestamp} - ${w.endTimestamp}): ${w.text}`
  )
  .join("\n\n")}

For each prediction found, respond with JSON array:
[
  {
    "segmentIndex": 0,
    "startTimestamp": "0:30",
    "predictionText": "The prediction",
    "predictionType": "stock|market|sector|macro|other",
    "targetDate": "YYYY-MM-DD or null",
    "confidence": 80
  }
]

Return empty array [] if no predictions found.`;

    try {
      const result = await model.generateContent(prompt);
      const response = result.response.text();

      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const batchPredictions = JSON.parse(jsonMatch[0]);

        for (const pred of batchPredictions) {
          // Parse timestamp to seconds
          const timestampParts = (pred.startTimestamp || "0:00").split(":");
          let timestampSec = 0;
          if (timestampParts.length === 3) {
            timestampSec =
              parseInt(timestampParts[0]!) * 3600 +
              parseInt(timestampParts[1]!) * 60 +
              parseInt(timestampParts[2]!);
          } else if (timestampParts.length === 2) {
            timestampSec =
              parseInt(timestampParts[0]!) * 60 + parseInt(timestampParts[1]!);
          }

          allPredictions.push({
            timestampSec,
            timestampFormatted: pred.startTimestamp || "0:00",
            predictionText: pred.predictionText,
            predictionType: pred.predictionType || "other",
            targetDate: pred.targetDate,
            confidence: pred.confidence || 50,
          });
        }
      }
    } catch (error) {
      console.error(`Error processing batch ${i}:`, error);
    }

    // Small delay between batches
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Filter out low confidence predictions
  return allPredictions.filter((p) => p.confidence >= 60);
};

