# Research Paper RAG System

A serverless, AI-powered research paper assistant that allows users to upload academic papers, create study sessions, and have intelligent conversations with their documents using Retrieval-Augmented Generation (RAG).

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
  - [High-Level Architecture](#high-level-architecture)
  - [Component Architecture](#component-architecture)
  - [Data Flow Diagrams](#data-flow-diagrams)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [AWS Services Used](#aws-services-used)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Deployment](#backend-deployment)
  - [Frontend Setup](#frontend-setup)
  - [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Data Models](#data-models)
- [Security](#security)

---

## Overview

This system enables researchers and students to:

1. **Upload PDF research papers** to a personal library
2. **Import papers** from Semantic Scholar and arXiv
3. **Create study sessions** by grouping related papers
4. **Ask questions** about papers and receive AI-generated answers with citations
5. **Visualize paper methodology** through auto-generated flowcharts
6. **Listen to responses** via text-to-speech

The backend is fully serverless, running on AWS Lambda with API Gateway. Vector embeddings are stored in Pinecone for semantic search, while metadata is stored in DynamoDB. The LLM (Claude 3 Haiku) and embedding model (Titan) are accessed through AWS Bedrock.

---

## Features

| Feature | Description |
|---------|-------------|
| PDF Upload | Upload research papers with automatic text extraction and chunking |
| External Import | Import papers from Semantic Scholar and arXiv by search or ID |
| Study Sessions | Group papers together for focused Q&A sessions |
| RAG Chat | Ask questions and get answers with source citations |
| Methodology Flowchart | Auto-generated visual representation of paper structure |
| NLP Analysis | Key phrase extraction, entity recognition, and sentiment analysis |
| Text-to-Speech | Listen to AI responses and flowchart content |
| Google OAuth | Sign in with Google for seamless authentication |
| Multi-tenant | Complete data isolation between users |

---

## Architecture

### High-Level Architecture

```mermaid
flowchart TB
    subgraph Users
        U[Users]
    end

    subgraph Frontend["Frontend (AWS Amplify)"]
        FE[Next.js 14 Application]
    end

    subgraph Auth["Authentication"]
        COG[AWS Cognito]
        GOOGLE[Google OAuth]
    end

    subgraph API["API Layer"]
        APIGW[API Gateway REST]
    end

    subgraph Compute["Compute Layer"]
        L1[paper-upload Lambda]
        L2[paper-processor Lambda]
        L3[chat-handler Lambda]
        L4[session-manager Lambda]
        L5[search-handler Lambda]
        L6[tts-handler Lambda]
        LAYER[Shared Lambda Layer]
    end

    subgraph Queue["Message Queue"]
        SQS[SQS Queue]
        DLQ[Dead Letter Queue]
    end

    subgraph AI["AI/ML Services"]
        BEDROCK[AWS Bedrock]
        TITAN[Titan Embeddings]
        CLAUDE[Claude 3 Haiku]
        COMPREHEND[Amazon Comprehend]
        POLLY[Amazon Polly]
    end

    subgraph Storage["Data Storage"]
        S3[S3 Bucket]
        DYNAMO[DynamoDB]
        PINECONE[Pinecone Vector DB]
    end

    subgraph External["External APIs"]
        SS[Semantic Scholar API]
        ARXIV[arXiv API]
    end

    U --> FE
    FE --> COG
    COG --> GOOGLE
    FE --> APIGW
    
    APIGW --> L1
    APIGW --> L3
    APIGW --> L4
    APIGW --> L5
    APIGW --> L6
    
    L1 --> SQS
    SQS --> L2
    SQS --> DLQ
    
    L1 --> S3
    L1 --> DYNAMO
    L2 --> S3
    L2 --> DYNAMO
    L2 --> BEDROCK
    L2 --> COMPREHEND
    L2 --> PINECONE
    
    L3 --> DYNAMO
    L3 --> BEDROCK
    L3 --> PINECONE
    
    L4 --> DYNAMO
    L5 --> DYNAMO
    L5 --> SS
    L5 --> ARXIV
    L6 --> POLLY
    L6 --> DYNAMO
    
    BEDROCK --> TITAN
    BEDROCK --> CLAUDE
    
    L1 -.-> LAYER
    L2 -.-> LAYER
    L3 -.-> LAYER
    L4 -.-> LAYER
    L5 -.-> LAYER
    L6 -.-> LAYER
```

### Component Architecture

#### Frontend Components

```mermaid
flowchart TB
    subgraph Pages["App Router Pages"]
        HOME["/"]
        LOGIN["/login"]
        SIGNUP["/signup"]
        CONFIRM["/signup/confirm"]
        CALLBACK["/auth/callback"]
        LIBRARY["/library"]
        SESSIONS["/sessions"]
        SESSION_ID["/sessions/[id]"]
        SEARCH["/search"]
        SETTINGS["/settings"]
    end

    subgraph Components["React Components"]
        subgraph Layout
            SIDEBAR[Sidebar]
            HEADER[Header]
        end
        subgraph Papers
            PAPERCARD[PaperCard]
            PAPERUPLOAD[PaperUpload]
            FLOWCHART[PaperFlowchart]
            AUDIO[AudioPlayer]
        end
        subgraph Chat
            CHATMSG[ChatMessage]
            CHATINPUT[ChatInput]
        end
        subgraph Sessions
            SESSIONCARD[SessionCard]
            CREATEMODAL[CreateSessionModal]
        end
        subgraph UI
            BUTTON[Button]
            INPUT[Input]
            MODAL[Modal]
            TOAST[Toast]
        end
    end

    subgraph Contexts
        AUTH[AuthContext]
    end

    subgraph Lib
        API[api.ts]
        AUTHLIB[auth.ts]
        TYPES[types.ts]
    end

    HOME --> AUTH
    LIBRARY --> PAPERCARD
    LIBRARY --> PAPERUPLOAD
    SESSION_ID --> FLOWCHART
    SESSION_ID --> CHATMSG
    SESSION_ID --> CHATINPUT
    SESSIONS --> SESSIONCARD
    SESSIONS --> CREATEMODAL
    
    CHATMSG --> AUDIO
    FLOWCHART --> API
    CHATMSG --> API
```

#### Lambda Function Architecture

```mermaid
flowchart TB
    subgraph SharedLayer["Shared Lambda Layer"]
        CONFIG[config.py]
        EMBED[embeddings.py]
        LLM[llm.py]
        VECTOR[vector_client.py]
        DYNAMO[dynamo_client.py]
        PDF[pdf_processor.py]
        COMP[comprehend_client.py]
        INSIGHTS[insights_generator.py]
        POLLY_CLIENT[polly_client.py]
        SS_CLIENT[semantic_scholar.py]
    end

    subgraph PaperUpload["paper-upload Lambda"]
        PU_HANDLER[handler.py]
        PU_UPLOAD[POST /papers]
        PU_IMPORT[POST /papers/import]
        PU_LIST[GET /papers]
        PU_GET[GET /papers/id]
        PU_INSIGHTS[GET /papers/id/insights]
        PU_DELETE[DELETE /papers/id]
    end

    subgraph PaperProcessor["paper-processor Lambda"]
        PP_HANDLER[handler.py]
        PP_SQS[SQS Trigger]
    end

    subgraph ChatHandler["chat-handler Lambda"]
        CH_HANDLER[handler.py]
        CH_CHAT[POST /chat]
    end

    subgraph SessionManager["session-manager Lambda"]
        SM_HANDLER[handler.py]
        SM_CREATE[POST /sessions]
        SM_LIST[GET /sessions]
        SM_GET[GET /sessions/id]
        SM_UPDATE[PUT /sessions/id]
        SM_DELETE[DELETE /sessions/id]
        SM_ADD[POST /sessions/id/papers]
        SM_REMOVE[DELETE /sessions/id/papers/id]
    end

    subgraph SearchHandler["search-handler Lambda"]
        SH_HANDLER[handler.py]
        SH_SEARCH[GET /search]
    end

    subgraph TTSHandler["tts-handler Lambda"]
        TTS_HANDLER[handler.py]
        TTS_PAPER[POST /tts/paper/id]
        TTS_TEXT[POST /tts/text]
        TTS_VOICES[GET /tts/voices]
    end

    SharedLayer --> PU_HANDLER
    SharedLayer --> PP_HANDLER
    SharedLayer --> CH_HANDLER
    SharedLayer --> SM_HANDLER
    SharedLayer --> SH_HANDLER
    SharedLayer --> TTS_HANDLER
```

#### Data Storage Architecture

```mermaid
flowchart TB
    subgraph S3["Amazon S3"]
        S3_BUCKET[research-papers-dev-ACCOUNT_ID]
        UPLOADS[uploads/user_id/doc_id.pdf]
        CHUNKS[chunks/doc_id/]
        TEMP[temp/]
    end

    subgraph DynamoDB["Amazon DynamoDB"]
        subgraph PapersTable["papers-metadata-dev"]
            PT_PK[PK: user_id]
            PT_SK[SK: document_id]
            PT_ATTRS[title, authors, status, s3_key, abstract, insights]
            PT_GSI1[GSI: status-index]
            PT_GSI2[GSI: user-upload-date-index]
        end
        
        subgraph SessionsTable["study-sessions-dev"]
            ST_PK[PK: user_id]
            ST_SK[SK: session_id]
            ST_ATTRS[name, paper_ids, created_at, last_active]
            ST_GSI[GSI: user-last-active-index]
        end
        
        subgraph ChatTable["chat-history-dev"]
            CT_PK[PK: session_id]
            CT_SK[SK: timestamp]
            CT_ATTRS[role, content, sources]
            CT_TTL[TTL enabled]
        end
    end

    subgraph Pinecone["Pinecone Vector Database"]
        PC_INDEX[Index: research-papers]
        PC_DIM[Dimension: 1024]
        PC_NS[Namespace: user_id]
        PC_META[Metadata: text, document_id, title, authors]
    end

    S3_BUCKET --> UPLOADS
    S3_BUCKET --> CHUNKS
    S3_BUCKET --> TEMP
```

### Data Flow Diagrams

#### Paper Upload and Processing Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant APIGateway
    participant PaperUpload
    participant S3
    participant DynamoDB
    participant SQS
    participant PaperProcessor
    participant Bedrock
    participant Comprehend
    participant Pinecone

    User->>Frontend: Upload PDF
    Frontend->>APIGateway: POST /papers
    APIGateway->>PaperUpload: Invoke Lambda
    PaperUpload->>S3: Generate presigned URL
    PaperUpload->>DynamoDB: Create record (status: pending)
    PaperUpload->>SQS: Send processing message
    PaperUpload-->>Frontend: Return presigned URL
    Frontend->>S3: Upload PDF directly
    
    SQS->>PaperProcessor: Trigger processing
    PaperProcessor->>S3: Download PDF
    PaperProcessor->>PaperProcessor: Extract text (PyMuPDF)
    PaperProcessor->>PaperProcessor: Chunk text (512 tokens)
    PaperProcessor->>Bedrock: Generate embeddings (Titan)
    Bedrock-->>PaperProcessor: Return 1024-dim vectors
    PaperProcessor->>Pinecone: Upsert vectors
    PaperProcessor->>Comprehend: Analyze text (NLP)
    Comprehend-->>PaperProcessor: Key phrases, entities, sentiment
    PaperProcessor->>Bedrock: Extract methodology (Claude)
    Bedrock-->>PaperProcessor: Structured flowchart JSON
    PaperProcessor->>DynamoDB: Save insights
    PaperProcessor->>DynamoDB: Update status (completed)
```

#### RAG Chat Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant APIGateway
    participant ChatHandler
    participant DynamoDB
    participant Bedrock
    participant Pinecone

    User->>Frontend: Ask question
    Frontend->>APIGateway: POST /chat
    APIGateway->>ChatHandler: Invoke Lambda
    
    ChatHandler->>DynamoDB: Get session (paper_ids)
    ChatHandler->>DynamoDB: Get chat history
    
    ChatHandler->>Bedrock: Embed question (Titan)
    Bedrock-->>ChatHandler: Question vector [1024]
    
    ChatHandler->>Pinecone: Query similar chunks
    Note over ChatHandler,Pinecone: namespace=user_id, filter=paper_ids
    Pinecone-->>ChatHandler: Top 5 relevant chunks
    
    ChatHandler->>ChatHandler: Build RAG prompt
    Note over ChatHandler: Context + History + Question
    
    ChatHandler->>Bedrock: Generate answer (Claude 3 Haiku)
    Bedrock-->>ChatHandler: AI response
    
    ChatHandler->>DynamoDB: Save user message
    ChatHandler->>DynamoDB: Save assistant message + sources
    
    ChatHandler-->>Frontend: Answer + citations
    Frontend-->>User: Display response
```

#### Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Cognito
    participant Google
    participant APIGateway

    alt Email/Password Login
        User->>Frontend: Enter credentials
        Frontend->>Cognito: InitiateAuth
        Cognito-->>Frontend: JWT tokens
    else Google OAuth
        User->>Frontend: Click "Sign in with Google"
        Frontend->>Cognito: Redirect to hosted UI
        Cognito->>Google: OAuth authorization
        Google-->>User: Consent screen
        User->>Google: Approve
        Google-->>Cognito: Authorization code
        Cognito->>Google: Exchange for tokens
        Google-->>Cognito: User info
        Cognito-->>Frontend: JWT tokens (via callback)
    end
    
    Frontend->>Frontend: Store tokens in cookies
    Frontend->>APIGateway: API request + Authorization header
    APIGateway->>APIGateway: Validate JWT
    APIGateway-->>Frontend: Protected resource
```

#### Methodology Flowchart Generation

```mermaid
sequenceDiagram
    participant PaperProcessor
    participant Comprehend
    participant Bedrock
    participant DynamoDB
    participant Frontend
    participant ReactFlow

    PaperProcessor->>Comprehend: Analyze paper text
    Comprehend-->>PaperProcessor: Key phrases, entities, sentiment
    
    PaperProcessor->>Bedrock: Extract methodology structure
    Note over PaperProcessor,Bedrock: Prompt: Extract problem, method, results, conclusion
    
    Bedrock-->>PaperProcessor: Structured JSON
    Note over Bedrock,PaperProcessor: {problem: {title, description}, method: {...}, ...}
    
    PaperProcessor->>PaperProcessor: Convert to ReactFlow format
    Note over PaperProcessor: Nodes with positions, edges with connections
    
    PaperProcessor->>DynamoDB: Save insights
    Note over DynamoDB: {methodology_flowchart, nlp_analysis, summary}
    
    Frontend->>DynamoDB: GET /papers/{id}/insights
    DynamoDB-->>Frontend: Insights JSON
    
    Frontend->>ReactFlow: Render flowchart
    ReactFlow-->>Frontend: Interactive diagram
```

---

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 14.x | React framework with App Router |
| React | 18.x | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.x | Utility-first styling |
| ReactFlow | 11.x | Interactive flowchart visualization |
| Lucide React | - | Icon library |
| clsx | - | Conditional class names |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Python | 3.11 | Lambda runtime |
| Boto3 | 1.34.x | AWS SDK |
| PyMuPDF | 1.23.x | PDF text extraction |
| Pinecone | 3.x | Vector database client |
| httpx | 0.25.x | HTTP client for external APIs |

### AWS Services

| Service | Purpose |
|---------|---------|
| AWS Amplify | Frontend hosting and CI/CD |
| Amazon Cognito | User authentication and OAuth |
| API Gateway | REST API management |
| AWS Lambda | Serverless compute |
| Amazon S3 | PDF file storage |
| Amazon DynamoDB | Metadata and session storage |
| Amazon SQS | Asynchronous processing queue |
| AWS Bedrock | LLM and embedding models |
| Amazon Comprehend | NLP analysis |
| Amazon Polly | Text-to-speech |
| AWS CloudWatch | Logging and monitoring |
| AWS X-Ray | Distributed tracing |

### External Services

| Service | Purpose |
|---------|---------|
| Pinecone | Vector database for embeddings |
| Google Cloud | OAuth identity provider |
| Semantic Scholar | Academic paper search API |
| arXiv | Preprint paper search API |

---

## Project Structure

```
research-paper-rag/
|
|-- infrastructure/              # AWS SAM infrastructure
|   |-- template.yaml            # CloudFormation template
|   |-- samconfig.toml           # SAM deployment config
|   |-- parameters-dev.json      # Environment parameters
|   |-- deploy.ps1               # Deployment script
|
|-- lambdas/                     # Lambda function code
|   |-- paper-upload/
|   |   |-- handler.py           # Upload, list, delete papers
|   |-- paper-processor/
|   |   |-- handler.py           # PDF processing pipeline
|   |-- chat-handler/
|   |   |-- handler.py           # RAG Q&A handler
|   |-- session-manager/
|   |   |-- handler.py           # Session CRUD operations
|   |-- search-handler/
|   |   |-- handler.py           # Unified search across sources
|   |-- text-to-speech/
|       |-- handler.py           # Amazon Polly TTS
|
|-- shared/                      # Shared Python modules
|   |-- __init__.py
|   |-- config.py                # Environment configuration
|   |-- embeddings.py            # Bedrock Titan embeddings
|   |-- llm.py                   # Bedrock Claude 3 Haiku
|   |-- vector_client.py         # Pinecone operations
|   |-- dynamo_client.py         # DynamoDB operations
|   |-- pdf_processor.py         # PDF extraction and chunking
|   |-- comprehend_client.py     # AWS Comprehend NLP
|   |-- insights_generator.py    # Methodology extraction
|   |-- polly_client.py          # Amazon Polly TTS
|   |-- semantic_scholar.py      # External API client
|
|-- frontend-1/                  # Next.js frontend
|   |-- src/
|   |   |-- app/                 # App Router pages
|   |   |   |-- page.tsx         # Home (redirect)
|   |   |   |-- login/           # Login page
|   |   |   |-- signup/          # Signup pages
|   |   |   |-- auth/callback/   # OAuth callback
|   |   |   |-- library/         # Paper library
|   |   |   |-- sessions/        # Study sessions
|   |   |   |-- search/          # Paper search
|   |   |   |-- settings/        # User settings
|   |   |-- components/          # React components
|   |   |   |-- papers/          # Paper-related components
|   |   |   |-- chat/            # Chat components
|   |   |   |-- sessions/        # Session components
|   |   |   |-- layout/          # Layout components
|   |   |   |-- ui/              # Reusable UI components
|   |   |-- contexts/            # React contexts
|   |   |-- lib/                 # Utilities and API client
|   |-- package.json
|   |-- next.config.mjs
|   |-- tailwind.config.js
|
|-- lambda-layer/                # Lambda layer build artifacts
|-- README.md
```

---

## AWS Services Used

### Compute

**AWS Lambda**
- Runtime: Python 3.11
- Memory: 256MB - 1024MB depending on function
- Timeout: 30s - 900s depending on function
- Layers: Shared code and dependencies

### Storage

**Amazon S3**
- Bucket: `research-papers-{env}-{account_id}`
- Encryption: AES-256 server-side
- Lifecycle rules for cost optimization
- CORS enabled for direct browser uploads

**Amazon DynamoDB**
- Billing: On-demand (pay per request)
- Encryption: AWS managed keys
- Point-in-time recovery: Enabled in production
- TTL: Enabled for chat history

**Pinecone**
- Index dimension: 1024 (Titan v2)
- Metric: Cosine similarity
- Namespaces: Per-user data isolation

### AI/ML

**AWS Bedrock**
- Embedding model: `amazon.titan-embed-text-v2:0`
- LLM: `anthropic.claude-3-haiku-20240307-v1:0`
- Region: us-east-1

**Amazon Comprehend**
- Key phrase extraction
- Named entity recognition
- Sentiment analysis

**Amazon Polly**
- Voice: Joanna (Neural)
- Output format: MP3

### Networking

**API Gateway**
- Type: REST API (Regional)
- Stage: dev/staging/prod
- CORS: Enabled
- Throttling: 50 req/s, burst 100

### Authentication

**Amazon Cognito**
- User Pool with email sign-up
- Google identity provider
- OAuth 2.0 flows: Authorization code, Implicit
- Token validity: Access 1h, Refresh 30d

### Monitoring

**Amazon CloudWatch**
- Lambda function logs
- API Gateway access logs
- Custom metrics and alarms

**AWS X-Ray**
- Distributed tracing enabled on all Lambdas

---

## Getting Started

### Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** configured with credentials
3. **AWS SAM CLI** for infrastructure deployment
4. **Node.js 18+** for frontend development
5. **Python 3.11** for Lambda development
6. **Pinecone Account** with an index created
7. **Google Cloud Project** with OAuth credentials (optional)

### Backend Deployment

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/research-paper-rag.git
cd research-paper-rag
```

2. **Create the Lambda Layer**

```bash
cd lambda-layer
mkdir python
pip install -r requirements.txt -t python/
cp -r ../shared python/
zip -r layer.zip python/
aws lambda publish-layer-version \
  --layer-name research-paper-rag-shared \
  --zip-file fileb://layer.zip \
  --compatible-runtimes python3.11
```

3. **Configure deployment parameters**

Edit `infrastructure/samconfig.toml`:

```toml
[default.deploy.parameters]
stack_name = "research-paper-rag-dev"
region = "us-east-1"
parameter_overrides = """
  Environment=dev
  PineconeApiKey=your-pinecone-api-key
  PineconeIndexName=research-papers
  PineconeHost=your-index-host.pinecone.io
  SharedLayerArn=arn:aws:lambda:us-east-1:ACCOUNT:layer:research-paper-rag-shared:VERSION
  PaperUploadRoleArn=arn:aws:iam::ACCOUNT:role/paper-upload-role
  PaperProcessorRoleArn=arn:aws:iam::ACCOUNT:role/paper-processor-role
  ChatHandlerRoleArn=arn:aws:iam::ACCOUNT:role/chat-handler-role
  SessionManagerRoleArn=arn:aws:iam::ACCOUNT:role/session-manager-role
  SearchHandlerRoleArn=arn:aws:iam::ACCOUNT:role/search-handler-role
  TTSHandlerRoleArn=arn:aws:iam::ACCOUNT:role/tts-handler-role
  GoogleClientId=your-google-client-id
  GoogleClientSecret=your-google-client-secret
  FrontendUrl=https://your-amplify-app.amplifyapp.com
"""
```

4. **Deploy with SAM**

```bash
cd infrastructure
sam build
sam deploy
```

5. **Note the outputs**

After deployment, note these values from CloudFormation outputs:
- `ApiEndpoint`
- `CognitoUserPoolId`
- `CognitoUserPoolClientId`
- `CognitoDomain`

### Frontend Setup

1. **Install dependencies**

```bash
cd frontend-1
npm install
```

2. **Configure environment variables**

Create `.env.local`:

```bash
NEXT_PUBLIC_API_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com/dev
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
NEXT_PUBLIC_COGNITO_CLIENT_ID=your-client-id
NEXT_PUBLIC_COGNITO_DOMAIN=https://your-domain.auth.us-east-1.amazoncognito.com
NEXT_PUBLIC_AWS_REGION=us-east-1
```

3. **Run development server**

```bash
npm run dev
```

4. **Build for production**

```bash
npm run build
```

5. **Deploy to AWS Amplify**

- Connect your GitHub repository to AWS Amplify
- Configure build settings (Next.js preset)
- Add environment variables in Amplify Console
- Deploy

### Environment Variables

#### Backend (Lambda)

| Variable | Description |
|----------|-------------|
| `AWS_REGION_NAME` | AWS region |
| `ENVIRONMENT` | dev/staging/prod |
| `S3_BUCKET_NAME` | Paper storage bucket |
| `PAPERS_TABLE` | DynamoDB papers table |
| `SESSIONS_TABLE` | DynamoDB sessions table |
| `CHAT_HISTORY_TABLE` | DynamoDB chat table |
| `PROCESSING_QUEUE_URL` | SQS queue URL |
| `PINECONE_API_KEY` | Pinecone API key |
| `PINECONE_INDEX_NAME` | Pinecone index name |
| `PINECONE_HOST` | Pinecone host URL |
| `VECTOR_DB_PROVIDER` | "pinecone" |
| `EMBEDDING_PROVIDER` | "bedrock" |
| `LLM_PROVIDER` | "bedrock" |

#### Frontend

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | API Gateway endpoint |
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | Cognito User Pool ID |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | Cognito App Client ID |
| `NEXT_PUBLIC_COGNITO_DOMAIN` | Cognito hosted UI domain |
| `NEXT_PUBLIC_AWS_REGION` | AWS region |

---

## API Reference

### Papers API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/papers` | Upload a new paper (returns presigned URL) |
| POST | `/papers/import` | Import paper from external source |
| GET | `/papers` | List all papers for user |
| GET | `/papers/{document_id}` | Get paper details |
| GET | `/papers/{document_id}/insights` | Get paper insights and flowchart |
| DELETE | `/papers/{document_id}` | Delete a paper |

### Sessions API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/sessions` | Create a new study session |
| GET | `/sessions` | List all sessions for user |
| GET | `/sessions/{session_id}` | Get session with papers |
| PUT | `/sessions/{session_id}` | Update session name |
| DELETE | `/sessions/{session_id}` | Delete a session |
| POST | `/sessions/{session_id}/papers` | Add paper to session |
| DELETE | `/sessions/{session_id}/papers/{document_id}` | Remove paper from session |

### Chat API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/chat` | Send a message and get RAG response |

Request body:
```json
{
  "user_id": "user-123",
  "session_id": "session-456",
  "question": "What is the main contribution?",
  "include_history": true
}
```

Response:
```json
{
  "answer": "The main contribution is...",
  "sources": [
    {
      "document_id": "doc-789",
      "title": "Paper Title",
      "authors": "Author Names",
      "relevance_score": 0.89
    }
  ],
  "session_id": "session-456",
  "chunks_used": 5
}
```

### Search API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/search?q={query}&sources={sources}` | Search papers across sources |

### TTS API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/tts/paper/{document_id}` | Synthesize paper summary |
| POST | `/tts/text` | Synthesize arbitrary text |
| GET | `/tts/voices` | List available voices |

---

## Data Models

### Paper

```typescript
interface Paper {
  document_id: string;      // UUID
  user_id: string;          // Cognito sub
  title: string;
  authors: string;
  abstract?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  upload_date: string;      // ISO 8601
  s3_key?: string;
  source: 'upload' | 'arxiv' | 'semantic_scholar';
  chunk_count?: number;
  insights?: PaperInsights;
}
```

### Session

```typescript
interface Session {
  session_id: string;       // UUID
  user_id: string;          // Cognito sub
  name: string;
  paper_ids: string[];
  created_at: string;       // ISO 8601
  last_active: string;      // ISO 8601
}
```

### Chat Message

```typescript
interface ChatMessage {
  session_id: string;
  timestamp: string;        // ISO 8601
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceCitation[];
  ttl?: number;             // Unix timestamp for expiry
}
```

### Paper Insights

```typescript
interface PaperInsights {
  document_id: string;
  methodology_flowchart: {
    nodes: FlowchartNode[];
    edges: FlowchartEdge[];
  };
  nlp_analysis: {
    key_phrases: Array<{text: string; score: number}>;
    entities: Record<string, Array<{text: string; score: number}>>;
    sentiment: {
      sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'MIXED';
      scores: Record<string, number>;
    };
  };
  summary?: string;
  generated_at: string;
}
```

---

## Security

### Authentication

- All API endpoints require authentication via JWT tokens
- Tokens are validated by API Gateway
- Cognito handles password hashing and storage
- OAuth 2.0 with PKCE for Google sign-in

### Authorization

- Users can only access their own data
- DynamoDB: `user_id` is partition key
- Pinecone: `user_id` is namespace
- S3: Objects stored under `uploads/{user_id}/`

### Data Protection

- S3: Server-side encryption (AES-256)
- DynamoDB: Encryption at rest with AWS managed keys
- API Gateway: HTTPS only
- Cognito: Secure password policies

### Network Security

- Lambda functions run in AWS-managed VPC
- API Gateway throttling prevents abuse
- CORS configured for frontend domain only in production

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## Acknowledgments

- AWS for the serverless infrastructure
- Anthropic for Claude 3 Haiku
- Pinecone for vector database
- Semantic Scholar and arXiv for paper APIs
