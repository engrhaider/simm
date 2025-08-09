from fastapi import FastAPI
import os
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from transformers import AutoProcessor, Gemma3ForConditionalGeneration, BitsAndBytesConfig
from peft import PeftModel
from huggingface_hub import login
from backend.api.v1.endpoints import auth # Adjusted import path
from backend.core.config import settings
import torch

def load_model():
    login(os.getenv("HUGGING_FACE_TOKEN"))
    print("Hugging Face loggedin successfully.")

    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    # lora_adapter = os.path.join(backend_dir, "../../../fine-tuned/exp-2-twitter-dataset-lora-r-16-la-32-lr-5e5-cosine")
    lora_adapter = os.path.join(backend_dir, "fine-tuned/exp-2-twitter-dataset-lora-r-16-la-32-lr-5e5-cosine")
    print("LORA ADAPTER DIR === ", lora_adapter)
    GEMMA3="google/gemma-3-4b-it"

    # quant_config = BitsAndBytesConfig(
    #     load_in_4bit=True,
    #     bnb_4bit_use_double_quant=True,
    #     bnb_4bit_quant_type="nf4",
    #     bnb_4bit_compute_dtype=torch.float16,
    #     bnb_4bit_quant_storage=torch.float16,
    # )

    # load model and multimodal processor
    base_model = Gemma3ForConditionalGeneration.from_pretrained(
        GEMMA3,
        # quantization_config=quant_config,
        attn_implementation="eager",
        device_map="auto",
        torch_dtype="auto",
        low_cpu_mem_usage=True
    )
    merged_model = PeftModel.from_pretrained(base_model, lora_adapter).merge_and_unload()
    processor = AutoProcessor.from_pretrained(GEMMA3, device_map=torch.float16)
    merged_model.eval()

    return merged_model, processor

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

app = FastAPI(title="Facebook Instagram API Integration", lifespan=lifespan)

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