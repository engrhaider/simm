from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
import torch
from collections import Counter
import re
from typing import List, Optional

router = APIRouter()


class SentimentRequest(BaseModel):
  comments: str


class SentimentResponse(BaseModel):
  comments: list[str]
  predictions: list[str]
  image_urls: list[list[str]]
  percentage_positive: float
  percentage_negative: float
  percentage_neutral: float 


def extract_image_urls(comment_text: str) -> List[str]:
  # Regex pattern to match image URLs with png, jpeg, jpg extensions
  image_url_pattern = r'https?://[^\s<>"]+\.(?:png|jpe?g)(?:\?[^\s<>"]*)?'
  # Find all matches in the comment text
  image_urls = re.findall(image_url_pattern, comment_text, re.IGNORECASE)
  
  return image_urls


def generate_prompt_from_text(comment_text: str, image_urls: List[str] = None):
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

  # Add all image URLs found in the comment
  if image_urls:
    for image_url in image_urls:
      user_message['content'].append({
        "type": "image",
        "image": image_url,
      })

  # the full message list including the system prompt
  messages = [
    {
      "role": "system",
      "content": [{"type": "text",
                   "text": "You are a helpful social-media sentiment-analysis assistant. You always reply with exactly one word: positive, negative, or neutral."}],
    },
    user_message,
  ]

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

    predictions.append(response.strip().lower())
    # print(predictions)

  return predictions


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


  # get the list of comments separated by delimiter <==>
  comments = [line.strip() for line in payload.comments.split('<==>') if line.strip()]

  if not comments:
    raise HTTPException(status_code=400, detail="No valid comments provided for analysis.")

  # Extract image URLs from each comment and prepare data
  all_image_urls = []
  data = []
  
  for comment in comments:
    # Extract image URLs from the current comment
    comment_image_urls = extract_image_urls(comment)
    all_image_urls.append(comment_image_urls)
    
    # Create prompt with both text and images
    prompt_data = generate_prompt_from_text(comment, comment_image_urls)
    data.append(prompt_data)

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
    "comments": comments,
    "predictions": sentiment_results,
    "image_urls": all_image_urls,
    "percentage_positive": positive_perc,
    "percentage_negative": negative_perc,
    "percentage_neutral": neutral_perc,
  }
