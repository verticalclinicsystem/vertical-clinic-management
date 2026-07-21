"""
AI router — endpoints for AI clinical note generation and analysis.
"""
import httpx
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.api.deps import get_current_active_user
from app.config import settings
from app.models.user import User
from app.utils.response import ApiResponse

logger = logging.getLogger(__name__)
router = APIRouter()

class SuggestedMedication(BaseModel):
    medicine_name: str
    dosage: str
    duration: str
    instructions: str

class AIAnalysisResult(BaseModel):
    summary: str
    suggested_medications: List[SuggestedMedication] = []
    suggested_treatment_plan: str
    treatment_plan_notes: Optional[str] = None

class AnalyzeNotesRequest(BaseModel):
    text: str
    scenario: Optional[str] = None

# Hardcoded fallback scenarios matching the prototype standard
FALLBACK_SCENARIOS = {
    "braces": {
        "summary": "Patient presents for scheduled orthodontic adjustment. No signs of infection or swelling. Wire tension increased on upper arch; lower arch elastics replaced. Mild sensitivity reported on tooth #14, recommend monitoring.\n\nSuggested next step: Continue 2-week adjustment cycle. Consider fluoride varnish if sensitivity persists.",
        "suggested_medications": [
            { "medicine_name": "Paracetamol 650mg", "dosage": "1 tab if pain", "duration": "3 days", "instructions": "Take twice a day" }
        ],
        "suggested_treatment_plan": "Braces Adjustment",
        "treatment_plan_notes": "Routine braces adjustment and wire tensioning."
    },
    "root_canal": {
        "summary": "Patient complaints of severe throbbing pain in the lower left molar for 3 days, sensitive to hot and cold liquids, swelling in gums. Clinical exam indicates acute pulpitis on tooth #19. Initial root canal preparation and pulp extirpation recommended.",
        "suggested_medications": [
            { "medicine_name": "Amoxicillin 500mg", "dosage": "1-1-1", "duration": "5 days", "instructions": "Take after meals" },
            { "medicine_name": "Ibuprofen 400mg", "dosage": "1-0-1", "duration": "3 days", "instructions": "Take if pain persists" }
        ],
        "suggested_treatment_plan": "Root Canal Therapy",
        "treatment_plan_notes": "Multi-stage root canal procedure for tooth #19 pulpitis."
    },
    "extraction": {
        "summary": "Clinical exam reveals partially erupted and mesioangularly impacted lower left third molar (tooth #17) causing pressure, local pain, and pericoronitis. Surgical extraction indicated to prevent further crowding and infection.",
        "suggested_medications": [
            { "medicine_name": "Diclofenac 50mg", "dosage": "1-0-1", "duration": "3 days", "instructions": "Take after food" },
            { "medicine_name": "Chlorhexidine Mouthwash 100ml", "dosage": "Rinse twice a day", "duration": "7 days", "instructions": "Use after brushing" }
        ],
        "suggested_treatment_plan": "Tooth Extraction",
        "treatment_plan_notes": "Surgical extraction of impacted lower left third molar (#17)."
    },
    "scaling": {
        "summary": "Patient complains of bleeding gums while brushing and yellow tartar buildup. Exam shows moderate supragingival and subgingival calculus deposition and localized gingival bleeding. Scaling and polishing recommended.",
        "suggested_medications": [
            { "medicine_name": "Chlorhexidine Mouthwash 100ml", "dosage": "Rinse twice a day", "duration": "10 days", "instructions": "Use after food" }
        ],
        "suggested_treatment_plan": "Scaling & Polishing",
        "treatment_plan_notes": "Full mouth scaling and root planing with oral hygiene instruction."
    }
}

def run_local_keyword_analyzer(text: str) -> dict:
    """Fallback local rule-based engine when LLM keys are placeholders or requests fail."""
    text_lower = text.lower()
    if any(k in text_lower for k in ["brace", "wire", "elastic", "ortho"]):
        return FALLBACK_SCENARIOS["braces"]
    elif any(k in text_lower for k in ["root", "canal", "pulp", "pain", "tooth 19"]):
        return FALLBACK_SCENARIOS["root_canal"]
    elif any(k in text_lower for k in ["extract", "impacted", "wisdom", "molar"]):
        return FALLBACK_SCENARIOS["extraction"]
    elif any(k in text_lower for k in ["scale", "scaling", "polish", "tartar", "bleeding"]):
        return FALLBACK_SCENARIOS["scaling"]
    
    # Default fallback
    return {
        "summary": f"Clinical Notes: Patient presented with: '{text}'. General consultation performed. Checked oral hygiene, no acute lesions detected.",
        "suggested_medications": [],
        "suggested_treatment_plan": "General Consultation",
        "treatment_plan_notes": "Routine examination."
    }

@router.post("/analyze-notes", response_class=JSONResponse)
async def analyze_clinical_notes(
    request: AnalyzeNotesRequest,
    current_user: User = Depends(get_current_active_user)
) -> JSONResponse:
    """
    Analyze dictated notes and return structured JSON recommendations.
    Uses either Groq, Gemini, or a rule-based fallback system.
    """
    text = request.text.strip()
    scenario = request.scenario
    
    if not text:
        return ApiResponse.error(
            message="Input text cannot be empty.",
            status_code=status.HTTP_400_BAD_REQUEST
        )

    # If the request specifically named a scenario and it is a fallback demo scenario, prioritize it for consistency
    if scenario in FALLBACK_SCENARIOS:
        return ApiResponse.success(
            data=FALLBACK_SCENARIOS[scenario],
            message="Scenario analysis generated successfully."
        )

    # Check if we should call external AI API
    use_real_api = False
    if settings.AI_PROVIDER == "groq" and settings.GROQ_API_KEY and not settings.GROQ_API_KEY.startswith("gsk_REPLACE_WITH"):
        use_real_api = True
    elif settings.AI_PROVIDER == "gemini" and settings.GEMINI_API_KEY and not settings.GEMINI_API_KEY.startswith("AIzaSy_REPLACE_WITH"):
        use_real_api = True

    if use_real_api:
        try:
            system_prompt = (
                "You are an AI Clinical Assistant for a dental clinic. Analyze the following doctor's voice dictation and output a valid JSON block.\n"
                "The JSON must have this schema:\n"
                "{\n"
                "  \"summary\": \"Concise clinical notes summary\",\n"
                "  \"suggested_medications\": [\n"
                "    { \"medicine_name\": \"Name\", \"dosage\": \"1-0-1\", \"duration\": \"5 days\", \"instructions\": \"Take after meals\" }\n"
                "  ],\n"
                "  \"suggested_treatment_plan\": \"Name of the primary dental procedure\",\n"
                "  \"treatment_plan_notes\": \"Brief details about the suggested treatment\"\n"
                "}\n"
                "Only output JSON. Do not include markdown code fence formatting (e.g. ```json) or any conversational text around the JSON."
            )
            
            if settings.AI_PROVIDER == "groq":
                headers = {
                    "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": settings.GROQ_MODEL or "llama-3.3-70b-versatile",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": text}
                    ],
                    "temperature": 0.1,
                    "response_format": {"type": "json_object"}
                }
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        content = data["choices"][0]["message"]["content"]
                        import json
                        parsed = json.loads(content)
                        return ApiResponse.success(data=parsed, message="AI analysis completed successfully via Groq.")
            
            elif settings.AI_PROVIDER == "gemini":
                headers = {"Content-Type": "application/json"}
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL or 'gemini-1.5-flash'}:generateContent?key={settings.GEMINI_API_KEY}"
                payload = {
                    "contents": [{
                        "parts": [{"text": f"{system_prompt}\n\nInput dictation:\n{text}"}]
                    }],
                    "generationConfig": {
                        "responseMimeType": "application/json"
                    }
                }
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(url, json=payload, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        content = data["candidates"][0]["content"]["parts"][0]["text"]
                        import json
                        parsed = json.loads(content)
                        return ApiResponse.success(data=parsed, message="AI analysis completed successfully via Gemini.")
        except Exception as e:
            logger.error(f"Error calling LLM provider {settings.AI_PROVIDER}: {e}. Falling back to rule-based parser.")

    # Fallback to local rule engine
    result = run_local_keyword_analyzer(text)
    return ApiResponse.success(
        data=result,
        message="AI simulation generated via local clinical engine."
    )
