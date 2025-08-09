from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
import torch
from collections import Counter

# No need for PIL/ImageFile here as we are only processing text comments
# from PIL import Image, ImageFile
# ImageFile.LOAD_TRUNCATED_IMAGES = True

router = APIRouter()


class SentimentRequest(BaseModel):
  comments: str


class SentimentResponse(BaseModel):
  positive: float
  negative: float
  neutral: float


# --- Helper function to create the prompt for the model ---
def generate_prompt_from_text(comment_text: str):
  """
    Formats a single text comment into the message structure expected by the model.
    """
  # The user message containing the comment to be analyzed
  user_message = {
    "role": "user",
    "content": [
      {
        "type": "text",
        "text": comment_text,
      }
    ],
  }

  # The full message list including the system prompt
  messages = [
    {
      "role": "system",
      "content": [{"type": "text",
                   "text": "You are a helpful social-media sentiment-analysis assistant. You always reply with exactly one word: positive, negative, or neutral."}],
    },
    user_message,
  ]

  # The final structure expected by the prediction function
  return {'messages': messages}


# --- Model Prediction Logic ---
def run_batch_prediction(data, model, processor):
  """
    Runs sentiment prediction on a batch of prepared comment prompts.
    """
  # This list will store the model's raw output (e.g., 'positive', 'negative')
  predictions = []

  # The tqdm progress bar will print to your server's console, which is useful for debugging.
  # from tqdm import tqdm
  # for i in tqdm(range(len(data)), desc="Predicting Sentiments"):

  for item in data:
    messages = item['messages']

    # Apply the chat template and tokenize the input
    inputs = processor.apply_chat_template(
      messages,
      add_generation_prompt=True,
      tokenize=True,
      return_dict=True,
      return_tensors="pt",
    ).to(model.device)

    input_len = inputs["input_ids"].shape[-1]

    # Generate the prediction in inference mode to save resources
    with torch.inference_mode():
      # Generate a short response, as we only expect one word.
      generation = model.generate(**inputs, max_new_tokens=5, do_sample=False)
      # Isolate the newly generated tokens
      generation = generation[0][input_len:]

    # Decode the generated tokens back into a string
    response = processor.decode(generation, skip_special_tokens=True)

    # Clean up the response and add it to our list of predictions
    # .lower() makes matching robust, .strip() removes whitespace
    predictions.append(response.strip().lower())

    print(predictions)

  return predictions


# --- API Endpoint ---
@router.post("/predict", response_model=SentimentResponse)
async def analyze_sentiment(req: Request, payload: SentimentRequest):
  """
    Analyzes the sentiment of a batch of comments provided in a single string.
    """
  # Retrieve the pre-loaded model and processor from the application state
  model = req.app.state.model
  processor = req.app.state.processor

  if not model or not processor:
    raise HTTPException(status_code=503, detail="Model is not loaded. Please wait or check server status.")

  # Split the incoming multiline string into a list of individual comments
  # and filter out any empty or whitespace-only lines.
  comments = [line.strip() for line in payload.comments.split('\n') if line.strip()]

  if not comments:
    raise HTTPException(status_code=400, detail="No valid comments provided for analysis.")

  # convert each comment string into the required prompt format.
  data = [generate_prompt_from_text(comment) for comment in comments]

  # get the list of sentiment predictions (e.g., ['positive', 'negative', 'positive'])
  sentiment_results = run_batch_prediction(data, model, processor)

  # count the percentage of each sentiment category
  sentiment_counts = Counter(sentiment_results)
  total_predictions = len(sentiment_results)

  if total_predictions == 0:
    return {"positive": 0, "negative": 0, "neutral": 0}

  # calculate the percentage for each sentiment category
  positive_perc = (sentiment_counts.get('positive', 0) / total_predictions) * 100
  negative_perc = (sentiment_counts.get('negative', 0) / total_predictions) * 100
  neutral_perc = (sentiment_counts.get('neutral', 0) / total_predictions) * 100

  return {
    "positive": positive_perc,
    "negative": negative_perc,
    "neutral": neutral_perc,
  }
