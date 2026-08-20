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
    "fever_flu": {
        "summary": "Patient presents with acute onset fever, headache, body aches, and nasal congestion for 2 days. Physical examination shows clear lung fields, no throat exudates. Vital signs show mild fever. Diagnosed with Acute Upper Respiratory Viral Infection.\n\nSuggested next step: Hydration, paracetamol as needed, rest, and follow-up if symptoms persist beyond 5 days.",
        "suggested_medications": [
            { "medicine_name": "Paracetamol 650mg", "dosage": "1-0-1", "duration": "3 days", "instructions": "Take after meals" },
            { "medicine_name": "Cetirizine 10mg", "dosage": "0-0-1", "duration": "5 days", "instructions": "Take before bed" }
        ],
        "suggested_treatment_plan": "Acute Viral Illness Care Plan",
        "treatment_plan_notes": "Symptomatic care, hydration, and fever management.",
        "allergy_warnings": []
    },
    "hypertension": {
        "summary": "Patient presents for routine blood pressure evaluation. BP recorded at 142/88 mmHg. Reports occasional mild morning headache. No chest pain or shortness of breath. Recommended lifestyle modification and baseline cardiovascular panel.",
        "suggested_medications": [
            { "medicine_name": "Telmisartan 40mg", "dosage": "1-0-0", "duration": "30 days", "instructions": "Take in the morning" }
        ],
        "suggested_treatment_plan": "Cardiovascular & BP Monitoring Plan",
        "treatment_plan_notes": "Daily BP logging, low sodium diet, and 30-day review.",
        "allergy_warnings": []
    },
    "diabetes": {
        "summary": "Patient for routine Type 2 Diabetes follow-up. Fasting blood sugar 138 mg/dL, post-prandial 185 mg/dL. HbA1c ordered. Reports mild fatigue. Foot examination normal.",
        "suggested_medications": [
            { "medicine_name": "Metformin 500mg", "dosage": "1-0-1", "duration": "30 days", "instructions": "Take with meals" }
        ],
        "suggested_treatment_plan": "Diabetic Management Plan",
        "treatment_plan_notes": "Glycemic control, HbA1c panel, and dietary consultation.",
        "allergy_warnings": []
    },
    "skin_allergy": {
        "summary": "Patient complains of itchy erythematous rash over forearms following environmental exposure. No mucosal involvement or airway constriction. Contact dermatitis diagnosed.",
        "suggested_medications": [
            { "medicine_name": "Levocetirizine 5mg", "dosage": "0-0-1", "duration": "5 days", "instructions": "Take after dinner" },
            { "medicine_name": "Hydrocortisone Cream 1%", "dosage": "Apply twice daily", "duration": "5 days", "instructions": "External application only" }
        ],
        "suggested_treatment_plan": "Dermatological Allergy Care Plan",
        "treatment_plan_notes": "Topical cream and oral antihistamine therapy.",
        "allergy_warnings": []
    },
    "gastroenteritis": {
        "summary": "Patient presented with abdominal discomfort, stomach pain, constipation, and loss of appetite for 2 days. Epigastric physical examination reveals soft abdomen without peritoneal signs. Clinical findings consistent with Epigastric Distress / Acute Dyspepsia.\n\nSuggested Plan: Prescribe proton pump inhibitor, mild osmotic laxative, dietary fiber intake, and 5-day clinical review.",
        "suggested_medications": [
            { "medicine_name": "Pantoprazole 40mg", "dosage": "1-0-0", "duration": "5 days", "instructions": "Take 30 min before breakfast" },
            { "medicine_name": "Syrup Lactulose 15ml", "dosage": "0-0-1", "duration": "3 days", "instructions": "Take at night with warm water" }
        ],
        "suggested_treatment_plan": "Gastrointestinal Care Plan",
        "treatment_plan_notes": "Bland diet, increased fluid intake, dietary fiber, and 5-day review.",
        "allergy_warnings": []
    }
}

def run_local_keyword_analyzer(text: str, allergies: List[str] = []) -> dict:
    """Fallback local rule-based engine when LLM keys are placeholders or requests fail."""
    text_lower = text.lower()
    if any(k in text_lower for k in ["stomach", "constipation", "digest", "gastric", "abdomen", "abdominal", "belly", "acidity", "acid", "nausea", "vomiting", "diarrhea", "gut", "bowel", "stool"]):
        res = dict(FALLBACK_SCENARIOS["gastroenteritis"])
    elif any(k in text_lower for k in ["fever", "cough", "cold", "flu", "headache", "chills", "fatigue", "body ache", "weakness"]):
        res = dict(FALLBACK_SCENARIOS["fever_flu"])
    elif any(k in text_lower for k in ["bp", "blood pressure", "hypertension", "heart", "chest"]):
        res = dict(FALLBACK_SCENARIOS["hypertension"])
    elif any(k in text_lower for k in ["sugar", "diabetes", "glucose", "hba1c"]):
        res = dict(FALLBACK_SCENARIOS["diabetes"])
    elif any(k in text_lower for k in ["skin", "rash", "allergy", "itching", "redness"]):
        res = dict(FALLBACK_SCENARIOS["skin_allergy"])
    else:
        clean_text = text.strip()
        if clean_text and not clean_text.endswith('.'):
            clean_text += '.'
        formatted = clean_text[0].upper() + clean_text[1:] if clean_text else "Patient presented for general medical evaluation."
        
        res = {
            "summary": f"Patient presented with chief complaints: {formatted} Clinical examination performed. Vital signs stable with no acute distress noted.\n\nSuggested Plan: General outpatient clinical review and symptomatic care as indicated.",
            "suggested_medications": [
                { "medicine_name": "Paracetamol 650mg", "dosage": "1-0-1", "duration": "3 days", "instructions": "Take after meals as needed" }
            ],
            "suggested_treatment_plan": "General OPD Consultation Plan",
            "treatment_plan_notes": "Symptomatic treatment and routine clinical review.",
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
                "You are an AI Clinical Assistant for a General Multi-Specialty Clinic. Analyze the doctor's clinical notes/voice dictation and produce a structured clinical analysis in valid JSON.\n"
                "In the 'summary' field, provide a professional, medical-grade summary (2-3 sentences framing chief complaints, organ system involved, clinical assessment, and recommended therapeutic plan).\n"
                "The JSON must have this exact schema:\n"
                "{\n"
                "  \"summary\": \"Professional clinical summary detailing presentation, findings, and clinical assessment\",\n"
                "  \"suggested_medications\": [\n"
                "    { \"medicine_name\": \"Name & Strength\", \"dosage\": \"1-0-1\", \"duration\": \"5 days\", \"instructions\": \"Specific instructions\" }\n"
                "  ],\n"
                "  \"suggested_treatment_plan\": \"Name of the primary clinical care plan\",\n"
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

