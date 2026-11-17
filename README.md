# Corvo Procurement Intelligence

> **Autonomous, Policy-Driven Procurement Automation & Governance Platform**  
> *Built for Cantill.ai Full-Stack Coding Challenge (Round 1)*

---

## 1. Executive Summary

**Corvo Procurement Intelligence** is a production-grade, enterprise procurement platform that automates the evaluation of employee purchase requisitions against organizational policy. The platform ingests purchase requests either through an interactive AI-powered conversational interface or bulk CSV batch uploads, clubs requisitions across plant locations within a 14-day calendar window (±7-day need-by), enforces rate contract ceilings, ranks preferred vendors via a 5-factor mathematical matrix, and issues deterministic Purchase Orders (PO) or Sourcing Requests (RFQ/RFP).

### The Core Architectural Guarantee: Policy-as-Data
Procurement leadership can upload an amended procurement policy (PDF or natural language text) and **change the application's decision-making behaviour across all plants and routes with ZERO source code modifications and ZERO system restarts**.

---

## 2. System Architecture

```mermaid
flowchart TD
    subgraph Client Layer
        Web["Next.js 14 App Router (Tailwind + Lucide + Framer Motion)"]
        ChatUI["Employee Chat Intake"]
        Workspace["Procurement Workspace & Drawer"]
        PolicyStudio["Policy Studio & Diff Viewer"]
        ContractsUI["Contract Register & PDF Discovery"]
    end

    subgraph API Layer ["Express + TypeScript REST API (Port 4000)"]
        BatchRoutes["POST /api/process-batch"]
        ChatRoutes["POST /api/chat/message"]
        PolicyRoutes["POST /api/policies/upload"]
        ContractRoutes["POST /api/contracts/upload"]
        SupplierRoutes["GET /api/suppliers/rankings"]
    end

    subgraph Deterministic Engines ["Core Business Engines (Pure TS)"]
        ItemMatching["Item Matching Engine (Token Normalizer + Levenshtein)"]
        Clubbing["14-Day Calendar Clubbing Engine"]
        Valuation["Valuation Engine (Contract > Historical PO > Master)"]
        ContractsEng["Contract Evaluation & Ceiling Tracker"]
        RankingEng["5-Factor Preferred Supplier Ranking Engine"]
        POConsolidation["24-Hour PO Consolidation Engine"]
        PolicyEngine["AST Dynamic Policy Engine"]
    end

    subgraph Data Store ["Storage & Persistence"]
        MongoDB[("MongoDB Atlas / Local Mongo 6.0")]
        DataStore["In-Memory CSV Cache / Fallback Store"]
        AuditTrail["Immutable Governance & Compliance Audit Trail"]
    end

    Web --> API Layer
    API Layer --> Deterministic Engines
    Deterministic Engines --> Data Store
```

---

## 3. Technology Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript (Strict Mode), Tailwind CSS, TanStack React Query v5, Framer Motion, Lucide React, Zod.
- **Backend**: Node.js v20/v22, Express, TypeScript, Zod request validation, Multer, `pdf-parse` for signed contract PDF extraction.
- **Policy Engine**: Pure JSON Abstract Syntax Tree (AST) condition evaluator supporting arbitrary logical predicates (`eq`, `neq`, `lt`, `lte`, `gt`, `gte`, `in`, `contains`, `between`, `date_before`, `date_after`, nested `all`/`any`).
- **AI Integration**: Provider-independent adapter supporting Google Gemini (`@google/genai`), OpenAI (`openai`), and heuristic rule-based NLP fallback. *AI is strictly restricted to intake assistance and policy drafting; final decisions are 100% deterministic.*
- **Database**: MongoDB with Mongoose ORM + In-Memory Singleton CSV Data Store fallback for 100% offline test execution.
- **Testing**: Vitest test runner with unit, integration, and worked-example regression suites.

---

## 4. Quick Start & One-Command Setup

### Prerequisites
- Node.js >= 20.0.0
- pnpm >= 9.0.0 (or npm)
- Docker & Docker Compose (Optional, for containerized run)

### Method A: Local Monorepo Run

```bash
# 1. Clone repository and navigate to corvo-procurement
cd corvo-procurement

# 2. Install workspace dependencies
pnpm install

# 3. Build shared packages
pnpm build:packages

# 4. Copy environment configuration
cp .env.example .env

# 5. Run automated test suite (verifies all 14 worked examples)
pnpm test

# 6. Start API server (Port 4000)
pnpm --filter @corvo/api dev

# 7. Start Web frontend (Port 3000 in a separate terminal)
pnpm --filter @corvo/web dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

### Method B: One-Command Docker Compose

```bash
# From corvo-procurement/ directory:
docker-compose up --build
```
This automatically boots MongoDB (`localhost:27017`), API (`localhost:4000`), and Web application (`localhost:3000`).

---

## 5. Mandatory API Endpoint: `POST /api/process-batch`

The mandatory endpoint processes PR batch CSV files adhering to the official challenge schema and generates deterministic procurement decisions.

### Endpoint Signature
- **URL**: `POST /api/process-batch`
- **Content-Type**: `multipart/form-data` (file upload) OR `application/json` (with raw CSV string)
- **Headers**:
  - `Accept: application/json` (returns structured JSON response)
  - `Accept: text/csv` (returns direct CSV file download)

### Request Example (cURL)
```bash
curl -X POST http://localhost:4000/api/process-batch \
  -F "file=@../Cantill_FullStack_Task_Kit/pr_batches/sample_pr_batch.csv"
```

### JSON Response Schema
```json
{
  "success": true,
  "batch_id": "BATCH-1731853200",
  "policy_version": "v5.0",
  "summary": {
    "total_pr_lines": 186,
    "total_requirement_groups": 104,
    "total_purchase_orders": 47,
    "total_sourcing_requests": 57,
    "total_procurement_value_inr": 28450120.45
  },
  "decisions": [ ... ],
  "requirements": [ ... ],
  "csv_rows": [
    {
      "pr_no": "PR-26-00001",
      "pr_line": 1,
      "resolved_item_code": "ITM-1011",
      "group_id": "GRP-PUN1-ITM-1011-20261108",
      "po_id": "PO-2026-0001",
      "decision": "PO",
      "route": "CONTRACT_PO",
      "supplier_id": "S001",
      "unit_price": 547.45,
      "group_value_inr": 82117.5,
      "suggested_supplier_ids": "",
      "policy_version": "v5.0",
      "reason": "Contract RC-2026-001 valid and ceiling available."
    }
  ]
}
```

---

## 6. Verification of Worked Examples & Regression Test

All 14 worked procurement decisions and 3 preferred-supplier rankings documented in `Worked_Examples.pdf` have been codified into automated unit and regression tests.

To run the full suite:
```bash
pnpm test
```

### Verified Test Matrix (38 Passing Tests):
1. **Item Matching Engine** (6 tests): Exact code match, token-level normalizer, domain abbreviation expansion (`brg`, `hyd`, `pneu`), and identification of NEW items.
2. **Policy-as-Data Engine** (3 tests): Evaluation of AST conditions, dynamic amendment proposals, and zero-code behavioral alteration.
3. **5-Factor Supplier Ranking** (3 tests): Replicates exact rank and scores for `ITM-1011`, `ITM-1025`, and `ITM-1036`.
4. **Rate Contract & Ceiling Tracking** (3 tests): Enforces value caps, valid horizons, and PDF contract discovery (`RC-2026-031` & `RC-2026-033`).
5. **PO Consolidation** (3 tests): 24-hour supplier/plant/route aggregation window.
6. **Requirement Clubbing** (4 tests): 14-day calendar window, ±7-day need-by window, plant segregation, emergency isolation.
7. **All 14 Worked Examples** (14 tests): 100% exact match of all worked example decisions.
8. **186-Line Batch Processing Integration** (2 tests): Evaluates the complete sample batch in < 150ms.

---

## 7. Submission Artifacts & Blind Test Readiness

The test runner and export services generate the three mandatory submission CSV files:
- `yourname__run1.csv`: Decision CSV under Policy v5.0.
- `yourname__run2.csv`: Decision CSV under amended Policy v5.1.
- `yourname__preferred.csv`: Ranked preferred suppliers for all catalog items.

To generate these files from the CLI:
```bash
pnpm --filter @corvo/api generate-submission
```

---

## 8. License & Confidentiality

Corvo Procurement Intelligence is developed for evaluation purposes. The underlying dataset files in `Cantill_FullStack_Task_Kit/` are kept strictly private and outside the public Git repository in compliance with challenge guidelines.
