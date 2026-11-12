"""
PETRAILS Veterinary Document Intelligence Service
Handles:
1. PDF text extraction (pypdf) & embedded image / standalone image OCR (RapidOCR)
2. Structured veterinary medical extraction (LLM when API key configured + deterministic text parser)
3. Comparison against declared assessment & pet medical fields (Match / Discrepancy / Missing)
4. Strict integrity: never fabricates extractions, never auto-verifies, never alters risk scores on upload.
"""

from __future__ import annotations

import io
import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx
import numpy as np
from PIL import Image
from pypdf import PdfReader

logger = logging.getLogger("petrails.document_intelligence")

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff", ".tif"}
MAX_DOCUMENT_BYTES = 15 * 1024 * 1024  # 15 MB

_rapid_ocr_instance = None


def _get_ocr_engine():
    global _rapid_ocr_instance
    if _rapid_ocr_instance is None:
        from rapidocr_onnxruntime import RapidOCR
        _rapid_ocr_instance = RapidOCR()
    return _rapid_ocr_instance


def _ocr_image_bytes(image_bytes: bytes) -> str:
    """Run RapidOCR on raw image bytes and return joined text lines."""
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img_np = np.array(img)
    ocr = _get_ocr_engine()
    result, _ = ocr(img_np)
    if not result:
        return ""
    lines = [str(item[1]).strip() for item in result if len(item) >= 2 and str(item[1]).strip()]
    return "\n".join(lines)


def extract_text_from_document(file_bytes: bytes, filename: str, content_type: Optional[str] = None) -> Tuple[str, str]:
    """
    Extract text from a PDF or image file.
    Returns (extracted_text, extraction_method).
    """
    ext = os.path.splitext(filename or "")[1].lower()
    is_pdf = ext == ".pdf" or (content_type and "pdf" in content_type.lower())

    if is_pdf:
        reader = PdfReader(io.BytesIO(file_bytes))
        page_texts: List[str] = []
        for page in reader.pages:
            txt = (page.extract_text() or "").strip()
            if txt:
                page_texts.append(txt)
        combined_text = "\n".join(page_texts).strip()
        if combined_text:
            return combined_text, "PDF_TEXT"

        # Scanned PDF fallback: OCR embedded page images if present
        ocr_texts: List[str] = []
        for page in reader.pages:
            try:
                for img_file in getattr(page, "images", []) or []:
                    txt = _ocr_image_bytes(img_file.data)
                    if txt:
                        ocr_texts.append(txt)
            except Exception as exc:
                logger.warning(f"PDF embedded image OCR skipped: {exc}")
        ocr_combined = "\n".join(ocr_texts).strip()
        if ocr_combined:
            return ocr_combined, "PDF_OCR"
        return "", "NO_TEXT_EXTRACTED"

    # Image OCR path
    ocr_text = _ocr_image_bytes(file_bytes).strip()
    if ocr_text:
        return ocr_text, "IMAGE_OCR"
    return "", "NO_TEXT_EXTRACTED"


EXTRACTION_FIELD_SPECS: List[Tuple[str, str]] = [
    ("preExistingConditions", "Pre-existing Conditions"),
    ("previousIllnesses", "Medical History / Illnesses"),
    ("previousSurgeries", "Previous Surgeries"),
    ("currentMedications", "Current Medications"),
    ("vaccinationDeclaration", "Vaccination Status"),
    ("allergies", "Allergies"),
    ("previousClaims", "Previous Claims"),
]


async def _try_llm_structured_extraction(extracted_text: str) -> Optional[Dict[str, Optional[str]]]:
    """
    If GEMINI_API_KEY or OPENAI_API_KEY is configured in the environment,
    use structured JSON extraction strictly grounded in `extracted_text`.
    Returns None if no key is configured or if the call fails.
    """
    if not extracted_text.strip():
        return None

    gemini_key = os.getenv("GEMINI_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")
    if not gemini_key and not openai_key:
        return None

    prompt = (
        "You are a veterinary underwriting document extractor. "
        "Extract ONLY facts explicitly stated in the document text below. "
        "Do NOT invent, infer, or guess any field that is not explicitly present; return null for missing fields. "
        "Return valid JSON with exact keys: "
        "petName, clinicName, veterinarian, documentDate, preExistingConditions, previousIllnesses, "
        "previousSurgeries, currentMedications, vaccinationDeclaration, allergies, previousClaims.\n\n"
        f"DOCUMENT TEXT:\n{extracted_text[:12000]}"
    )

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            if gemini_key:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={gemini_key}"
                resp = await client.post(
                    url,
                    json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {"temperature": 0, "responseMimeType": "application/json"},
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    raw = data["candidates"][0]["content"]["parts"][0]["text"]
                    parsed = json.loads(raw)
                    if isinstance(parsed, dict):
                        return parsed
            elif openai_key:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {openai_key}"},
                    json={
                        "model": "gpt-4o-mini",
                        "temperature": 0,
                        "response_format": {"type": "json_object"},
                        "messages": [{"role": "user", "content": prompt}],
                    },
                )
                if resp.status_code == 200:
                    raw = resp.json()["choices"][0]["message"]["content"]
                    parsed = json.loads(raw)
                    if isinstance(parsed, dict):
                        return parsed
    except Exception as exc:
        logger.warning(f"External AI structured extraction unavailable, falling back to deterministic parser: {exc}")

    return None


def _clean_extracted_value(val: Optional[str]) -> Optional[str]:
    if not val:
        return None
    cleaned = re.sub(r"\s+", " ", str(val)).strip(" :-\t\n\r")
    return cleaned if cleaned else None


def parse_veterinary_text_deterministic(extracted_text: str) -> Dict[str, Optional[str]]:
    """
    Deterministic structured veterinary parser grounded strictly in actual extracted text.
    Never fabricates values not present in `extracted_text`.
    """
    fields: Dict[str, Optional[str]] = {
        "petName": None,
        "clinicName": None,
        "veterinarian": None,
        "documentDate": None,
        "preExistingConditions": None,
        "previousIllnesses": None,
        "previousSurgeries": None,
        "currentMedications": None,
        "vaccinationDeclaration": None,
        "allergies": None,
        "previousClaims": None,
    }
    if not extracted_text or not extracted_text.strip():
        return fields

    lines = [line.strip() for line in extracted_text.splitlines() if line.strip()]

    label_patterns: List[Tuple[str, List[str]]] = [
        ("petName", [r"pet\s*name", r"patient\s*name", r"animal\s*name"]),
        ("clinicName", [r"clinic(?:\s*name)?", r"hospital(?:\s*name)?", r"veterinary\s*center"]),
        ("veterinarian", [r"veterinarian", r"attending\s*vet", r"vet\s*name", r"doctor"]),
        ("documentDate", [r"(?:visit|exam|report|record|document)\s*date", r"^date"]),
        ("preExistingConditions", [r"pre[-\s]*existing\s*conditions?", r"chronic\s*conditions?", r"ongoing\s*conditions?"]),
        ("previousIllnesses", [r"medical\s*history", r"previous\s*illness(?:es)?", r"diagnosis", r"clinical\s*findings?", r"assessment"]),
        ("previousSurgeries", [r"previous\s*surger(?:y|ies)", r"surger(?:y|ies)", r"surgical\s*history", r"procedures?"]),
        ("currentMedications", [r"current\s*medications?", r"medications?", r"prescriptions?", r"\brx\b"]),
        ("vaccinationDeclaration", [r"vaccinations?", r"immunization(?:s)?", r"vaccines?"]),
        ("allergies", [r"allerg(?:y|ies)", r"adverse\s*reactions?"]),
        ("previousClaims", [r"previous\s*claims?", r"claim\s*history", r"prior\s*claims?"]),
    ]

    for line in lines:
        for field_key, pats in label_patterns:
            for pat in pats:
                m = re.match(rf"^(?:{pat})\s*[:\-]\s*(.+)$", line, flags=re.IGNORECASE)
                if m:
                    val = _clean_extracted_value(m.group(1))
                    if val:
                        existing = fields.get(field_key)
                        if not existing:
                            fields[field_key] = val
                        elif val.lower() not in existing.lower():
                            fields[field_key] = f"{existing}; {val}"
                    break

    # Keyword-based fallback ONLY when explicit clinical terms appear in the extracted text
    full_lower = extracted_text.lower()
    if not fields["vaccinationDeclaration"]:
        vacc_hits = re.findall(
            r"\b(rabies|dhpp|dhlpp|parvo(?:virus)?|distemper|fvrcp|bordetella|leptospirosis)\b[^\n.;]*",
            extracted_text,
            flags=re.IGNORECASE,
        )
        if vacc_hits:
            # Capture the actual lines containing vaccine names
            matched_lines = [
                ln for ln in lines
                if re.search(r"\b(rabies|dhpp|dhlpp|parvo|distemper|fvrcp|bordetella|leptospirosis|vaccin)\b", ln, flags=re.IGNORECASE)
            ]
            if matched_lines:
                fields["vaccinationDeclaration"] = "; ".join(matched_lines[:3])

    if not fields["veterinarian"]:
        dr_match = re.search(r"\b(Dr\.?\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)", extracted_text)
        if dr_match:
            fields["veterinarian"] = _clean_extracted_value(dr_match.group(1))

    if not fields["documentDate"]:
        date_match = re.search(r"\b(\d{4}-\d{2}-\d{2}|\d{2}/\d{2}/\d{4})\b", full_lower)
        if date_match:
            fields["documentDate"] = date_match.group(1)

    return fields


async def extract_structured_veterinary_data(extracted_text: str) -> Tuple[Dict[str, Optional[str]], str]:
    """
    Run structured extraction on `extracted_text`.
    Returns (structured_fields, extraction_engine).
    """
    if not extracted_text or not extracted_text.strip():
        return parse_veterinary_text_deterministic(""), "NONE"

    llm_fields = await _try_llm_structured_extraction(extracted_text)
    if llm_fields is not None:
        normalized: Dict[str, Optional[str]] = {}
        for key in [
            "petName", "clinicName", "veterinarian", "documentDate",
            "preExistingConditions", "previousIllnesses", "previousSurgeries",
            "currentMedications", "vaccinationDeclaration", "allergies", "previousClaims"
        ]:
            normalized[key] = _clean_extracted_value(llm_fields.get(key))
        return normalized, "AI_STRUCTURED"

    return parse_veterinary_text_deterministic(extracted_text), "STRUCTURED_PARSER"


def _is_none_like(value: Optional[str]) -> bool:
    if not value:
        return True
    v = value.strip().lower()
    return v in {"none", "none declared", "no", "n/a", "na", "nil", "not provided", "unknown", "healthy", "none reported", "0"}


def _tokens_match(a: str, b: str) -> bool:
    a_norm = re.sub(r"[^a-z0-9\s]", " ", a.lower()).strip()
    b_norm = re.sub(r"[^a-z0-9\s]", " ", b.lower()).strip()
    if not a_norm or not b_norm:
        return False
    if a_norm == b_norm or a_norm in b_norm or b_norm in a_norm:
        return True
    stop = {"the", "and", "with", "for", "of", "on", "in", "to", "a", "an", "is", "are", "was"}
    a_tokens = {t for t in a_norm.split() if len(t) > 2 and t not in stop}
    b_tokens = {t for t in b_norm.split() if len(t) > 2 and t not in stop}
    if not a_tokens or not b_tokens:
        return False
    overlap = a_tokens & b_tokens
    return len(overlap) / min(len(a_tokens), len(b_tokens)) >= 0.5


def compare_extracted_with_declarations(
    extracted_fields: Dict[str, Optional[str]],
    assessment: Dict[str, Any],
    pet_doc: Optional[Dict[str, Any]] = None,
) -> Tuple[List[Dict[str, Any]], Dict[str, int]]:
    """
    Compare extracted document fields against existing assessment & pet declarations.
    Flags: MATCH, DISCREPANCY, MISSING_IN_DECLARATION, MISSING_IN_DOCUMENT, NOT_PRESENT.
    """
    underwriting_data = dict(assessment.get("underwritingData") or {})

    # Build effective declared values (combining assessment.underwritingData + pet arrays if needed)
    declared_map: Dict[str, Optional[str]] = {
        "preExistingConditions": _clean_extracted_value(underwriting_data.get("preExistingConditions")),
        "previousIllnesses": _clean_extracted_value(underwriting_data.get("previousIllnesses")),
        "previousSurgeries": _clean_extracted_value(underwriting_data.get("previousSurgeries")),
        "currentMedications": _clean_extracted_value(underwriting_data.get("currentMedications")),
        "vaccinationDeclaration": _clean_extracted_value(underwriting_data.get("vaccinationDeclaration")),
        "allergies": _clean_extracted_value(underwriting_data.get("allergies")),
        "previousClaims": _clean_extracted_value(underwriting_data.get("previousClaims")),
    }

    if pet_doc:
        if not declared_map["previousIllnesses"] and pet_doc.get("medicalHistory"):
            events = [
                f"{m.get('event') or m.get('diagnosis') or ''}".strip()
                for m in pet_doc.get("medicalHistory", [])
                if isinstance(m, dict)
            ]
            events = [e for e in events if e]
            if events:
                declared_map["previousIllnesses"] = "; ".join(events)
        if not declared_map["previousSurgeries"] and pet_doc.get("surgeries"):
            surgs = [s.get("surgeryName", "").strip() for s in pet_doc.get("surgeries", []) if isinstance(s, dict) and s.get("surgeryName")]
            if surgs:
                declared_map["previousSurgeries"] = "; ".join(surgs)
        if not declared_map["currentMedications"] and pet_doc.get("medications"):
            meds = [m.get("name", "").strip() for m in pet_doc.get("medications", []) if isinstance(m, dict) and m.get("name")]
            if meds:
                declared_map["currentMedications"] = "; ".join(meds)
        if not declared_map["vaccinationDeclaration"] and pet_doc.get("vaccinations"):
            vaccs = [f"{v.get('vaccineName', '')} ({v.get('status', '')})".strip() for v in pet_doc.get("vaccinations", []) if isinstance(v, dict)]
            if vaccs:
                declared_map["vaccinationDeclaration"] = "; ".join(vaccs)

    comparisons: List[Dict[str, Any]] = []
    counts = {
        "matchesCount": 0,
        "discrepanciesCount": 0,
        "missingInDeclarationCount": 0,
        "missingInDocumentCount": 0,
    }

    for field_key, label in EXTRACTION_FIELD_SPECS:
        declared_val = declared_map.get(field_key)
        extracted_val = _clean_extracted_value(extracted_fields.get(field_key))

        declared_empty = declared_val is None
        extracted_empty = extracted_val is None

        if declared_empty and extracted_empty:
            status = "NOT_PRESENT"
            note = "Neither declared at intake nor found in this document."
        elif not declared_empty and not extracted_empty:
            if (_is_none_like(declared_val) and _is_none_like(extracted_val)) or _tokens_match(declared_val, extracted_val):
                status = "MATCH"
                note = "Document finding aligns with the existing declaration."
                counts["matchesCount"] += 1
            else:
                status = "DISCREPANCY"
                note = "Document finding differs from the existing declaration and requires underwriter review."
                counts["discrepanciesCount"] += 1
        elif declared_empty and not extracted_empty:
            if _is_none_like(extracted_val):
                status = "MATCH"
                note = "Document confirms none reported."
                counts["matchesCount"] += 1
            else:
                status = "MISSING_IN_DECLARATION"
                note = "Found in uploaded veterinary document, but missing from existing declaration."
                counts["missingInDeclarationCount"] += 1
        else:
            status = "MISSING_IN_DOCUMENT"
            note = "Present in existing declaration, but not mentioned in this document."
            counts["missingInDocumentCount"] += 1

        comparisons.append({
            "field": field_key,
            "label": label,
            "declaredValue": declared_val,
            "extractedValue": extracted_val,
            "status": status,
            "note": note,
        })

    return comparisons, counts


async def analyze_veterinary_document(
    file_bytes: bytes,
    filename: str,
    content_type: Optional[str],
    uploaded_by: str,
    assessment: Dict[str, Any],
    pet_doc: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Execute full Veterinary Document Intelligence pipeline without modifying risk scores
    or auto-verifying the document.
    """
    extracted_text, extraction_method = extract_text_from_document(file_bytes, filename, content_type)
    extracted_fields, extraction_engine = await extract_structured_veterinary_data(extracted_text)
    comparisons, summary_counts = compare_extracted_with_declarations(extracted_fields, assessment, pet_doc)

    now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    return {
        "id": f"doc-{uuid.uuid4().hex[:10]}",
        "fileName": filename,
        "contentType": content_type or "application/octet-stream",
        "fileSizeBytes": len(file_bytes),
        "uploadedAt": now_iso,
        "uploadedBy": uploaded_by,
        "extractionMethod": extraction_method,
        "extractionEngine": extraction_engine,
        "extractedTextPreview": extracted_text[:1200] if extracted_text else "",
        "extractedFields": extracted_fields,
        "comparisons": comparisons,
        "summary": summary_counts,
        "verificationStatus": "EXTRACTED_UNVERIFIED",
        "reviewStatus": "PENDING_REVIEW",
        "reviewedBy": None,
        "reviewedAt": None,
        "acceptedFields": [],
        "reviewNotes": None,
    }

