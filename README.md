# Cloud Research Workspace

Upload your own PDFs to S3, index their metadata in DynamoDB, and search papers by keyword across Semantic Scholar, arXiv, and your personal library—all behind a FastAPI backend and a clean Next.js + Tailwind frontend.

## Stack

- **Backend:** FastAPI, Uvicorn, boto3, PyPDF2, Semantic Scholar + arXiv APIs, DynamoDB, S3  
- **Frontend:** Next.js (App Router), React, Tailwind CSS  
- **Tooling:** `start-backend.bat`, `start-frontend.bat`, `.gitignore`, `requirements.txt`

## Features

1. **PDF upload**: Validates PDF, extracts metadata/summary with PyPDF2, stores file in S3 (`research-papers-cc`), writes metadata to DynamoDB (`research-papers-metadata`).  
2. **Unified search**: `/search` aggregates Semantic Scholar, arXiv, and your S3 library.  
3. **Library API**: `/library`, `/paper/{id}`, deletion endpoint, plus `/health`.  
4. **Frontend UI**: Two-panel dashboard (upload + search) with drag/drop upload, progress states, result cards.  
5. **Auto API base URL**: Frontend auto-detects current host if `NEXT_PUBLIC_API_BASE_URL` isn’t set.

## Prerequisites

- Python 3.10+ and Node 18+  
- AWS account with access to S3 + DynamoDB (bucket `research-papers-cc`, table `research-papers-metadata` with primary key `document_id`)  
- Semantic Scholar API key

## Quick Start

1. **Backend**

   - Edit `start-backend.bat`, replacing the placeholders:
     ```
     set "AWS_ACCESS_KEY_ID=..."
     set "AWS_SECRET_ACCESS_KEY=..."
     set "SEMANTIC_SCHOLAR_API_KEY=..."
     ```
   - Run:
     ```cmd
     start-backend.bat
     ```
   - This creates/activates `venv`, installs `requirements.txt`, and launches `uvicorn main:app --host 0.0.0.0 --port 8000 --reload`.

2. **Frontend**

   - (Optional) Update `NEXT_PUBLIC_API_BASE_URL` inside `start-frontend.bat` if your backend isn’t on `http://localhost:8000`.
   - Run:
     ```cmd
     start-frontend.bat
     ```
   - Starts Next.js dev server on `http://localhost:3000` (also available at your LAN IP).

## Manual Setup (if you prefer)

```bash
# Backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Frontend
cd frontend
npm install
npm run dev
```

## Environment Variables

- **Backend (`.env` or system env)**  
  - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`  
  - `SEMANTIC_SCHOLAR_API_KEY`

- **Frontend (`.env.local` or `start-frontend.bat`)**  
  - `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`

## Key Endpoints

| Method | Path | 
| --- | --- | --- |
| `POST /upload` | Upload PDF → S3 + DynamoDB |
| `GET /search` | Unified search (Semantic Scholar, arXiv, library) |
| `GET /library` | List user’s uploaded papers |
| `GET /paper/{document_id}` | Fetch metadata for one paper |
| `DELETE /paper/{document_id}` | Remove from S3 & DynamoDB |
| `GET /health` | Check service connectivity |

## Frontend Structure

- `app/layout.tsx`: global shell
- `app/page.tsx`: home grid (upload + search)
- `components/UploadCard.tsx`
- `components/SearchCard.tsx`
- `lib/useApiBaseUrl.ts`: auto-detect API base URL
- `lib/api.ts`: REST helpers (optional)

## Future Enhancements

- Full-text/OpenSearch indexing for richer queries  
- Authentication (Cognito or similar)  
- Signed URLs for PDF viewing/downloading  
- Production deployment (Docker, ECS/EKS, etc.)

---
