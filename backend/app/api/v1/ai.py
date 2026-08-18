"""
AI router — endpoints for AI clinical note generation and analysis.
"""
import httpx
import logging
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, File, UploadFile, status
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
    allergy_warnings: List[str] = []

class AnalyzeNotesRequest(BaseModel):
    text: str
    scenario: Optional[str] = None
    patient_allergies: List[str] = []
    patient_id: Optional[str] = None

# Cross-reactivity & allergy mapping helper
PENICILLIN_DERIVATIVES = ["amoxicillin", "ampicillin", "augmentin", "penicillin", "amoxil", "clavulanate"]

def check_allergy_conflicts(medications: List[dict] | List[Any] | Any, allergies: List[str]) -> List[str]:
    """Check if any suggested medication conflicts with patient's active allergies."""
    warnings = []
    if not allergies or not medications or not isinstance(medications, list):
        return warnings

    norm_allergies = [a.lower().strip() for a in allergies if isinstance(a, str) and a.strip()]
    
    for med in medications:
        if isinstance(med, dict):
            med_name = str(med.get("medicine_name", "")).lower()
            orig_name = str(med.get("medicine_name", ""))
        else:
            med_name = str(med).lower()
            orig_name = str(med)
        
        for allergy in norm_allergies:
            # Direct name match
            if allergy in med_name or med_name in allergy:
                warnings.append(f"ALLERGY WARNING: Suggested medication '{orig_name}' conflicts with patient's documented allergy to '{allergy.capitalize()}'.")
                continue
            
            # Penicillin cross-reactivity match
            if allergy in ["penicillin", "penicillins"] and any(deriv in med_name for deriv in PENICILLIN_DERIVATIVES):
                warnings.append(f"ALLERGY ALERT: Patient is allergic to Penicillin. Suggested medication '{orig_name}' is a Penicillin-class antibiotic.")
                
    return list(set(warnings))

# Hardcoded fallback scenarios matching the prototype standard
FALLBACK_SCENARIOS = {
    "braces": {
        "summary": "Patient presents for scheduled orthodontic adjustment. No signs of infection or swelling. Wire tension increased on upper arch; lower arch elastics replaced. Mild sensitivity reported on tooth #14, recommend monitoring.\n\nSuggested next step: Continue 2-week adjustment cycle. Consider fluoride varnish if sensitivity persists.",
        "suggested_medications": [
            { "medicine_name": "Paracetamol 650mg", "dosage": "1 tab if pain", "duration": "3 days", "instructions": "Take twice a day" }
        ],
        "suggested_treatment_plan": "Braces Adjustment",
        "treatment_plan_notes": "Routine braces adjustment and wire tensioning.",
        "allergy_warnings": []
    },
    "root_canal": {
        "summary": "Patient complaints of severe throbbing pain in the lower left molar for 3 days, sensitive to hot and cold liquids, swelling in gums. Clinical exam indicates acute pulpitis on tooth #19. Initial root canal preparation and pulp extirpation recommended.",
        "suggested_medications": [
            { "medicine_name": "Amoxicillin 500mg", "dosage": "1-1-1", "duration": "5 days", "instructions": "Take after meals" },
            { "medicine_name": "Ibuprofen 400mg", "dosage": "1-0-1", "duration": "3 days", "instructions": "Take if pain persists" }
        ],
        "suggested_treatment_plan": "Root Canal Therapy",
        "treatment_plan_notes": "Multi-stage root canal procedure for tooth #19 pulpitis.",
        "allergy_warnings": []
    },
    "extraction": {
        "summary": "Clinical exam reveals partially erupted and mesioangularly impacted lower left third molar (tooth #17) causing pressure, local pain, and pericoronitis. Surgical extraction indicated to prevent further crowding and infection.",
        "suggested_medications": [
            { "medicine_name": "Diclofenac 50mg", "dosage": "1-0-1", "duration": "3 days", "instructions": "Take after food" },
            { "medicine_name": "Chlorhexidine Mouthwash 100ml", "dosage": "Rinse twice a day", "duration": "7 days", "instructions": "Use after brushing" }
        ],
        "suggested_treatment_plan": "Tooth Extraction",
        "treatment_plan_notes": "Surgical extraction of impacted lower left third molar (#17).",
        "allergy_warnings": []
    },
    "scaling": {
        "summary": "Patient complains of bleeding gums while brushing and yellow tartar buildup. Exam shows moderate supragingival and subgingival calculus deposition and localized gingival bleeding. Scaling and polishing recommended.",
        "suggested_medications": [
            { "medicine_name": "Chlorhexidine Mouthwash 100ml", "dosage": "Rinse twice a day", "duration": "10 days", "instructions": "Use after food" }
        ],
        "suggested_treatment_plan": "Scaling & Polishing",
        "treatment_plan_notes": "Full mouth scaling and root planing with oral hygiene instruction.",
        "allergy_warnings": []
    }
}

def run_local_keyword_analyzer(text: str, allergies: List[str] = []) -> dict:
    """Fallback local rule-based engine when LLM keys are placeholders or requests fail."""
    text_lower = text.lower()
    if any(k in text_lower for k in ["brace", "wire", "elastic", "ortho"]):
        res = dict(FALLBACK_SCENARIOS["braces"])
    elif any(k in text_lower for k in ["root", "canal", "pulp", "pain", "tooth 19"]):
        res = dict(FALLBACK_SCENARIOS["root_canal"])
    elif any(k in text_lower for k in ["extract", "impacted", "wisdom", "molar"]):
        res = dict(FALLBACK_SCENARIOS["extraction"])
    elif any(k in text_lower for k in ["scale", "scaling", "polish", "tartar", "bleeding"]):
        res = dict(FALLBACK_SCENARIOS["scaling"])
    else:
        res = {
            "summary": f"Clinical Notes: Patient presented with: '{text}'. General consultation performed. Checked oral hygiene, no acute lesions detected.",
            "suggested_medications": [],
            "suggested_treatment_plan": "General Consultation",
            "treatment_plan_notes": "Routine examination.",
            "allergy_warnings": []
        }
    
    res["allergy_warnings"] = check_allergy_conflicts(res.get("suggested_medications", []), allergies)
    return res


@router.post("/transcribe", response_class=JSONResponse)
async def transcribe_voice_dictation(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user)
) -> JSONResponse:
    """
    Transcribe recorded medical voice audio using Groq Whisper Large V3 API.
    Processes audio completely in RAM memory (In-Memory Blob) without writing any files to disk.
    """
    if not file or not file.filename:
        return ApiResponse.error(
            message="Audio file is required for dictation transcription.",
            status_code=status.HTTP_400_BAD_REQUEST
        )
    
    contents = await file.read()
    if len(contents) == 0:
        return ApiResponse.error(
            message="Recorded audio file is empty.",
            status_code=status.HTTP_400_BAD_REQUEST
        )

    # Use Groq Whisper Large V3 if GROQ_API_KEY is configured
    if settings.AI_PROVIDER == "groq" and settings.GROQ_API_KEY and not settings.GROQ_API_KEY.startswith("gsk_REPLACE_WITH"):
        try:
            headers = {
                "Authorization": f"Bearer {settings.GROQ_API_KEY}"
            }
            files = {
                "file": (file.filename or "voice_recording.webm", contents, file.content_type or "audio/webm")
            }
            data = {
                "model": "whisper-large-v3",
                "response_format": "json"
            }
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    "https://api.groq.com/openai/v1/audio/transcriptions",
                    headers=headers,
                    files=files,
                    data=data
                )
                if resp.status_code == 200:
                    res_json = resp.json()
                    transcribed_text = res_json.get("text", "").strip()
                    logger.info(f"Groq Whisper V3 transcription successful: {transcribed_text[:60]}...")
                    return ApiResponse.success(
                        data={"text": transcribed_text},
                        message="Voice dictation transcribed successfully via Groq Whisper Large V3."
                    )
                else:
                    logger.error(f"Groq Whisper API returned status {resp.status_code}: {resp.text}")
                    return ApiResponse.error(
                        message=f"Groq Whisper transcription error ({resp.status_code}): {resp.text}",
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )
        except Exception as e:
            logger.error(f"Failed to process Groq Whisper transcription: {e}")
            return ApiResponse.error(
                message=f"Voice transcription request failed: {str(e)}",
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    return ApiResponse.error(
        message="Groq API key is not configured. Please set GROQ_API_KEY in backend/.env.",
        status_code=status.HTTP_400_BAD_REQUEST
    )


@router.post("/analyze-notes", response_class=JSONResponse)
async def analyze_clinical_notes(
    request: AnalyzeNotesRequest,
    current_user: User = Depends(get_current_active_user)
) -> JSONResponse:
    """
    Analyze dictated notes and return structured JSON recommendations.
    Evaluates patient allergies and generates safety alerts if conflicts exist.
    """
    text = request.text.strip()
    scenario = request.scenario
    allergies = request.patient_allergies or []
    
    if not text:
        return ApiResponse.error(
            message="Input text cannot be empty.",
            status_code=status.HTTP_400_BAD_REQUEST
        )

    # If scenario requested explicitly
    if scenario in FALLBACK_SCENARIOS:
        data = dict(FALLBACK_SCENARIOS[scenario])
        data["allergy_warnings"] = check_allergy_conflicts(data.get("suggested_medications", []), allergies)
        return ApiResponse.success(
            data=data,
            message="Scenario analysis generated successfully."
        )

    # Check external AI API
    use_real_api = False
    if settings.AI_PROVIDER == "groq" and settings.GROQ_API_KEY and not settings.GROQ_API_KEY.startswith("gsk_REPLACE_WITH"):
        use_real_api = True
    elif settings.AI_PROVIDER == "gemini" and settings.GEMINI_API_KEY and not settings.GEMINI_API_KEY.startswith("AIzaSy_REPLACE_WITH"):
        use_real_api = True

    if use_real_api:
        try:
            allergy_context = ""
            if allergies:
                allergy_context = f"\nCRITICAL PATIENT SAFETY: The patient is documented to be ALLERGIC to: {', '.join(allergies)}. DO NOT suggest medications containing or cross-reacting with these allergens."
            
            system_prompt = (
                "You are an AI Clinical Assistant for a dental clinic. Analyze the following doctor's voice dictation and output a valid JSON block.\n"
                "The JSON must have this exact schema:\n"
                "{\n"
                "  \"summary\": \"Concise clinical summary of patient condition and procedure needed\",\n"
                "  \"suggested_medications\": [\n"
                "    { \"medicine_name\": \"Name\", \"dosage\": \"1-0-1\", \"duration\": \"5 days\", \"instructions\": \"Take after meals\" }\n"
                "  ],\n"
                "  \"suggested_treatment_plan\": \"Name of the primary dental procedure\",\n"
                "  \"treatment_plan_notes\": \"Brief details about the suggested treatment plan\"\n"
                "}\n"
                f"{allergy_context}\n"
                "Only output JSON. Do not include markdown code fence formatting (e.g. ```json) or any conversational text."
            )
            
            if settings.AI_PROVIDER == "groq":
                headers = {
                    "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                    "Content-Type": "application/json"
                }
                # Model fallbacks in case configured model is unavailable
                models_to_try = [settings.GROQ_MODEL, "openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.6-27b", "groq/compound-mini"]
                # Deduplicate while preserving order
                seen = set()
                models_to_try = [m for m in models_to_try if m and not (m in seen or seen.add(m))]
                
                async with httpx.AsyncClient(timeout=15.0) as client:
                    for model_name in models_to_try:
                        payload = {
                            "model": model_name,
                            "messages": [
                                {"role": "system", "content": system_prompt},
                                {"role": "user", "content": text}
                            ],
                            "temperature": 0.1
                        }
                        resp = await client.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers)
                        if resp.status_code == 200:
                            data = resp.json()
                            content = data["choices"][0]["message"]["content"]
                            
                            # Clean markdown code fences if present
                            cleaned = content.strip()
                            if cleaned.startswith("```json"):
                                cleaned = cleaned[7:]
                            if cleaned.startswith("```"):
                                cleaned = cleaned[3:]
                            if cleaned.endswith("```"):
                                cleaned = cleaned[:-3]
                            
                            import json
                            parsed = json.loads(cleaned.strip())
                            parsed["allergy_warnings"] = check_allergy_conflicts(parsed.get("suggested_medications", []), allergies)
                            logger.info(f"Groq AI clinical analysis successful using model '{model_name}'.")
                            return ApiResponse.success(data=parsed, message=f"AI analysis completed successfully via Groq ({model_name}).")
                        else:
                            logger.warning(f"Groq model '{model_name}' returned status {resp.status_code}: {resp.text}")
            
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
                async with httpx.AsyncClient(timeout=15.0) as client:
                    resp = await client.post(url, json=payload, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        content = data["candidates"][0]["content"]["parts"][0]["text"]
                        
                        cleaned = content.strip()
                        if cleaned.startswith("```json"):
                            cleaned = cleaned[7:]
                        if cleaned.startswith("```"):
                            cleaned = cleaned[3:]
                        if cleaned.endswith("```"):
                            cleaned = cleaned[:-3]

                        import json
                        parsed = json.loads(cleaned.strip())
                        parsed["allergy_warnings"] = check_allergy_conflicts(parsed.get("suggested_medications", []), allergies)
                        return ApiResponse.success(data=parsed, message="AI analysis completed successfully via Gemini.")
        except Exception as e:
            logger.error(f"Error calling LLM provider {settings.AI_PROVIDER}: {e}. Falling back to local analyzer.")

    # Fallback to local rule engine
    result = run_local_keyword_analyzer(text, allergies)
    return ApiResponse.success(
        data=result,
        message="AI analysis generated via local clinical engine."
    )

