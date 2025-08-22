from fastapi import FastAPI
import os
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from transformers import AutoProcessor, Gemma3ForConditionalGeneration, BitsAndBytesConfig
from peft import PeftModel
from huggingface_hub import login
from backend.api.v1.endpoints import auth  # Adjusted import path
from backend.core.config import settings
import torch

load_fine_tuned = True
load_quantized = True
local_testing = False


def load_model():
  login(os.getenv("HUGGING_FACE_TOKEN"))
  print("Hugging Face loggedin successfully.")
  # get current directory
  current_dir = os.path.dirname(os.path.abspath(__file__))

  # lora adapter path when testing locally with my mac
  if local_testing:
    lora_adapter = "/Users/engrhaider/web-workbench/sa-inf-model/fine-tuned/exp-2-twitter-dataset-lora-r-16-la-32-lr-5e5-cosine"
  else:
    # lora adapter path when testing on server
    lora_adapter = os.path.join(current_dir, "./lora_adapter")

  GEMMA3 = "google/gemma-3-4b-it"

  quant_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_use_double_quant=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.bfloat16,
    bnb_4bit_quant_storage=torch.bfloat16,
  )

  # construct model kwargs
  model_kwargs = {
    "attn_implementation": "eager",
    "device_map": "cpu" if local_testing else "auto",
    "torch_dtype": "auto",
    "low_cpu_mem_usage": True,
  }
  if load_quantized:
    model_kwargs["quantization_config"] = quant_config

  # load model and multimodal processor
  base_model = Gemma3ForConditionalGeneration.from_pretrained(GEMMA3, **model_kwargs)
  processor = AutoProcessor.from_pretrained(GEMMA3, device_map="auto")

  if load_fine_tuned:
    merged_model = PeftModel.from_pretrained(base_model, lora_adapter).merge_and_unload()
    merged_model.eval()
    return merged_model, processor
  else:
    base_model.eval()
    return base_model, processor


@asynccontextmanager
async def lifespan(app: FastAPI):
  print("Application startup: Loading model...")
  model, processor = load_model()
  app.state.model = model
  app.state.processor = processor
  print("Model and processor loaded and stored in app.state.")
  yield
  print("Application shutdown: Clearing resources.")
  app.state.model = None
  app.state.processor = None
  torch.cuda.empty_cache()


app = FastAPI(title="Multimodal Sentiment Analysis Inference", lifespan=lifespan)

# Set up CORS
origins = [
  os.getenv("FRONTEND_URL"),  # Next.js frontend
]

app.add_middleware(
  CORSMiddleware,
  allow_origins=origins,
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)


@app.get("/", summary="Root endpoint", tags=["Root"])
async def root():
  return {"message": "Welcome to the SIM app."}


# Include the authentication router
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"])

from backend.api.v1.endpoints import facebook, sentiment

app.include_router(facebook.router, prefix=f"{settings.API_V1_STR}/facebook", tags=["Facebook"])
app.include_router(sentiment.router, prefix=f"{settings.API_V1_STR}/sentiment", tags=["Sentiment"])
