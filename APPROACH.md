# Corvo Procurement Intelligence — Engineering Approach

This document provides a detailed technical overview of the architecture, algorithmic design, and engineering methodologies implemented in **Corvo Procurement Intelligence**. It explains how the system processes purchase requisitions, executes policy rules, maintains auditability, and enforces organizational governance.

---

## 1. Problem Understanding

Enterprise manufacturing organizations operate multiple production facilities that generate hundreds of purchase requisitions (PRs) each week. Managing this volume through manual review or disparate ERP workflows creates several systemic problems:

- **Rogue and Maverick Purchasing**: Requisitions are frequently routed through spot purchases or non-contract vendors despite the existence of negotiated rate contracts with volume pricing.
- **Split Requisitions and Missed Volume Discounts**: Operating plants frequently submit separate requisitions for identical or interchangeable spare parts days apart. Without cross-requisition aggregation, the organization pays higher unit prices and misses commercial leverage.
- **Contract Ceiling Overruns**: Rate agreements typically carry financial value ceilings (e.g., ₹20,00,000). When multiple departments purchase against the same contract without centralized real-time ceiling tracking, contracts are overdrawn, exposing the company to commercial and legal disputes.
- **Inflexible Policy Enforcement**: Procurement committees periodically update threshold rules (e.g., raising emergency purchase limits or mandating RFP routing for capex). In traditional systems, these rules are hardcoded into backend code, requiring developer intervention, testing cycles, and software redeployments for every policy change.
- **Unstructured Requisition Descriptions**: Requisitions submitted by plant maintenance personnel frequently omit standardized catalog codes and use free-text descriptions, colloquial abbreviations (`brg`, `hyd`, `pneu`), or raw model numbers, causing manual catalog lookup delays.

Corvo Procurement Intelligence was designed to solve these operational challenges by combining intelligent text intake, deterministic multi-stage grouping and valuation algorithms, and an Abstract Syntax Tree (AST) policy engine that treats organizational procurement rules as versioned, executable data.

---

## 2. Goals and Design Principles

The architecture is guided by six core engineering principles:

1. **Determinism Over Probabilistic Inference**: Final procurement decisions (issuing a purchase order vs. initiating an RFQ/RFP), price valuations, and vendor rankings must be 100% reproducible and auditable. Probabilistic AI models are never permitted to make autonomous financial or routing decisions.
2. **Policy-as-Data**: Business rules, monetary thresholds, and routing logic are stored as structured JSON Abstract Syntax Trees. Business policies can be updated, diffed, and activated at runtime without modifying application source code or restarting services.
3. **End-to-End Traceability**: Every automated decision must provide a human-readable justification citing the exact policy clause, contract agreement, or historical price record that produced it.
4. **Segregation of Duties**: The system strictly separates operational procurement actions (performed by Buyers) from governance, policy activation, and user administration (controlled exclusively by Administrators).
5. **Stateful Budget and Ceiling Integrity**: Contract ceilings and historical purchase tracking must reflect state transitions in real time, preventing double-allocation within batch runs.
6. **Graceful Degradation and Resilience**: In production, the system connects to MongoDB Atlas; however, for local development, test automation, and offline evaluations, the system includes an in-memory CSV singleton store allowing full offline execution with zero external dependencies.

---

## 3. Overall Architecture

The application is structured as a TypeScript monorepo managed with PNPM Workspaces, separating user interfaces, backend services, and shared schemas:

```
[ Next.js 14 Web Frontend ]  <--- HTTP/JSON --->  [ Express REST API ]
       (apps/web)                                      (apps/api)
           │                                               │
           ▼                                               ▼
  [ @corvo/shared-types ]                        [ Pure TS Decision Engines ]
  [ @corvo/policy-schema ]                                 │
                                                           ▼
                                                [ MongoDB Atlas / Mongoose ]
                                                [ In-Memory CSV Fallback   ]
                                                [ Immutable Audit Trail    ]
```

### Monorepo Components
- **`apps/web`**: Next.js 14 App Router application delivering the user experience. Features include the Conversational Intake Chat, Requisition Workspace, Approvals and Override Dashboard, Rate Contract & Supplier Registers, Policy Studio with visual AST diffing, and the Admin User Management Console.
- **`apps/api`**: Express backend providing RESTful endpoints, JWT authentication middleware, file parsing (`csv-parse`, `pdf-parse`, `multer`), and the deterministic procurement execution pipeline.
- **`packages/shared-types`**: Canonical TypeScript interfaces shared across frontend and backend, preventing type drift between client state and API payloads.
- **`packages/policy-schema`**: Zod validation schemas and AST type definitions governing procurement policies and amendment proposals.

---

## 4. Purchase Request Processing Flow

Every batch of purchase requisitions—whether uploaded via bulk CSV or submitted line-by-line through the chat interface—passes through a deterministic 7-stage pipeline:

```mermaid
flowchart LR
    S1["1. Ingestion & Normalization"] --> S2["2. Hybrid Item Matching"]
    S2 --> S3["3. 14-Day Clubbing"]
    S3 --> S4["4. Valuation Hierarchy"]
    S4 --> S5["5. Contract Evaluation"]
    S5 --> S6["6. Policy AST Routing"]
    S6 --> S7["7. Ranking & PO Consolidation"]
```

1. **Ingestion & Normalization**: Validates CSV structure or chat inputs against the 13-column canonical schema, standardizes date formats to ISO-8601 (`YYYY-MM-DD`), and enforces numeric bounds on quantities and prices.
2. **Hybrid Item Matching**: Resolves free-text line descriptions to standard catalog items (`ITM-XXXX`) or isolates uncataloged items.
3. **Requirement Clubbing**: Groups lines by resolved item and plant within a 14-day calendar window (±7-day need-by proximity), isolating emergency requests.
4. **Valuation**: Calculates total requirement value using a strict price priority hierarchy.
5. **Contract Evaluation**: Validates active rate contracts, checks supplier active status, and manages cumulative ceiling consumption.
6. **Policy AST Routing**: Evaluates the requirement context against the active policy's predicate tree to determine the procurement decision (`PO` vs. `SOURCING_REQUEST`) and route.
7. **Supplier Ranking & PO Consolidation**: Ranks eligible suppliers via a 5-factor mathematical matrix and consolidates same-supplier/plant/route POs within a 24-hour window.

---

## 5. Policy Engine Design

### The Problem with Hardcoded Rules
Traditional procurement applications write business rules directly in code:
```typescript
// Anti-pattern: Hardcoded business rules
if (value < 200000 && !isEmergency) {
  return { decision: 'PO', route: 'SPOT_PO' };
}
```
When management revises thresholds, developers must edit code, run test suites, and deploy releases.

### The Solution: Abstract Syntax Tree (AST) Evaluator
Corvo represents policy rules as structured JSON trees evaluated by a pure, recursive TypeScript engine (`policy-engine.ts`). The engine supports arbitrary predicate expressions without using unsafe JavaScript `eval()`.

#### Supported AST Operators
- **Comparison**: `eq`, `neq`, `lt`, `lte`, `gt`, `gte`, `between`
- **Membership**: `in`, `contains`
- **Temporal**: `date_before`, `date_after`
- **Boolean Logic**: `all` (logical AND), `any` (logical OR), `not` (logical NOT)

#### Example Policy Rule (AST Schema)
```json
{
  "id": "RULE-SPOT-PO",
  "name": "Spot Purchase Order",
  "priority": 10,
  "condition": {
    "all": [
      { "field": "group_value_inr", "operator": "lt", "value": 200000 },
      { "field": "urgency", "operator": "neq", "value": "EMERGENCY" },
      { "field": "has_active_contract", "operator": "eq", "value": false },
      { "field": "is_new_item", "operator": "eq", "value": false },
      { "field": "category", "operator": "neq", "value": "Capex" }
    ]
  },
  "action": {
    "decision": "PO",
    "route": "SPOT_PO",
    "requires_buyer_approval": false,
    "reason_template": "Requirement value ₹{group_value_inr} is below ₹2,00,000 spot threshold with active supplier available."
  }
}
```

#### Evaluation Lifecycle
At evaluation time, the engine constructs a runtime context for each requirement group (containing item category, monetary value, contract presence, remaining ceiling, supplier status, and historical purchase count). Rules are evaluated in descending priority order; the first rule whose condition tree evaluates to `true` determines the procurement decision.

---

## 6. Policy Versioning and Amendments

To enable policy updates without code deployment, Corvo implements a formal policy lifecycle:

1. **Draft / Proposal**: An Administrator uploads a policy amendment circular (PDF or text). An AI extraction service identifies changed clauses and produces a structured AST diff.
2. **AST Validation**: The proposed policy document is validated against `@corvo/policy-schema` to ensure type safety, valid operator definitions, and syntax correctness.
3. **Side-by-Side Visual Diffing**: The Policy Studio UI renders an exact clause-by-clause comparison showing altered thresholds, new rules, and deleted conditions.
4. **Administrative Approval**: Only authenticated Administrators can approve and activate the proposed policy. Buyers may view draft comparisons but cannot activate them.
5. **Atomic Pointer Switch**: Upon approval, the active policy version pointer in MongoDB is updated atomically (e.g., from `v5.0` to `v5.1`). All subsequent batch processing and chat requests immediately evaluate against the new policy without restarting the server.

---

## 7. Item Matching and Requirement Clubbing

### Hybrid Item Matching Engine (`item-matching.ts`)
In production datasets, requisitions frequently lack official catalog numbers (e.g., 39 out of 186 rows in the sample batch omit `item_code`). To handle this:

1. **Exact Code Lookup**: If a valid `item_code` is provided and exists in `item_master.csv`, it is accepted immediately.
2. **Domain Token Normalization**:
   - Strips noise phrases (`urgent`, `for breakdown maintenance`, `sample attached`, `repeat order`).
   - Expands technical domain abbreviations:
     - `brg` &rarr; `ball bearing`
     - `hyd` &rarr; `hydraulic`
     - `pneu` &rarr; `pneumatic`
     - `welding rod` &rarr; `welding electrode`
3. **Model Number Preservation**: Technical identifiers (e.g., `6308`, `32210`, `50:1`, `24V`) are treated as strict invariant tokens. A description referencing `6308` will never match `ITM-1012` (`6205`), regardless of string similarity.
4. **Token Similarity Scoring**: Applies Levenshtein distance and token overlap against normalized catalog titles. Matches with confidence $\ge 0.70$ are resolved to the catalog code.
5. **New Item Isolation**: In the evaluation dataset, exactly two items (`PR-26-00170` "Drinking water purifier 50 LPH" and `PR-26-00171` "Ultrasonic thickness gauge") do not exist in the 73-item catalog. The engine detects zero valid matches and correctly classifies them as `NEW`, routing them to `NEW_ITEM_SOURCING` rather than forcing an inaccurate match.

### 14-Day Calendar Requirement Clubbing (`requirement-clubbing.ts`)
To prevent artificial requisition splitting and capture volume savings:
- **Clubbing Key**: `resolved_item_code + plant + calendar_window_id`.
- **Calendar Window**: 14 calendar days anchored to the earliest requisition date in the group.
- **Need-By Proximity**: Requisitions within the 14-day window are only grouped if their need-by dates fall within a ±7-day window of each other.
- **Urgency Segregation**: Requisitions marked `EMERGENCY` bypass standard clubbing and are placed into isolated groups to prevent production line-down delays.
- **New Item Segregation**: Uncataloged items are never clubbed with standard inventory.

---

## 8. Supplier Ranking Methodology

When a requirement group requires supplier assignment, the engine evaluates eligible suppliers using a 5-factor mathematical matrix calibrated against the official worked examples:

$$\text{Total Score} = (0.25 \times S_{\text{freq}}) + (0.25 \times S_{\text{rec}}) + (0.15 \times S_{\text{cont}}) + (0.20 \times S_{\text{ot}}) + (0.15 \times S_{\text{qual}})$$

### Factor Scoring Definitions
1. **PO Frequency ($S_{\text{freq}}$, 25% weight)**: Number of purchase orders awarded to the supplier for the item across all plants in the preceding 548 days (18 months), capped at 10 POs:
   $$S_{\text{freq}} = \frac{\min(N_{\text{pos}}, 10)}{10} \times 25.0$$
2. **Order Recency ($S_{\text{rec}}$, 25% weight)**: Days elapsed since the supplier's most recent PO for the item:
   - $\le 90$ days: 25.0 points
   - $91 - 365$ days: 12.5 points
   - $> 365$ days: 0.0 points
3. **Contract History ($S_{\text{cont}}$, 15% weight)**: Awarded 15.0 points if the supplier holds an active rate contract starting on or before the evaluation date covering the item; 0.0 points otherwise.
4. **On-Time Delivery ($S_{\text{ot}}$, 20% weight)**: Historical on-time delivery percentage from `supplier_master.csv`:
   $$S_{\text{ot}} = \left(\frac{\text{on\_time\_delivery\_pct}}{100.0}\right) \times 20.0$$
5. **Quality Rating ($S_{\text{qual}}$, 15% weight)**: Historical quality rating (out of 5.0) from `supplier_master.csv`:
   $$S_{\text{qual}} = \left(\frac{\text{quality\_rating}}{5.0}\right) \times 15.0$$

### Tie-Breaking Hierarchy
When two suppliers achieve identical composite scores, ties are resolved deterministically:
1. Higher On-Time Delivery percentage.
2. Higher Quality Rating.
3. Lower Reference Unit Price.
4. Lexicographically smaller `supplier_id`.

### Supplier Eligibility Filtering
Only suppliers with an active status (`status === 'Active'`) in `supplier_master.csv` are eligible for ranking. Suppliers marked `Blocked` (such as `S004`) or `Inactive` are strictly disqualified per Policy v5.0 Clause 5.7.

---

## 9. Contract and Historical PO Evaluation

### Priority Valuation Hierarchy
The unit price for any requirement group is determined by a strict priority cascade:
1. **Active Rate Contract Price**: Used if an active contract covers the item and has sufficient financial ceiling remaining.
2. **Ceiling-Exceeded Fallback**: If a contract exists but the requirement value breaches the remaining ceiling, the unit price falls back to the lowest historical PO rate paid within the previous 365 days.
3. **Lowest 365-Day Historical Rate**: Used when no contract exists.
4. **Standard Master Catalog Price**: Used when no purchases occurred in the previous 365 days.
5. **Requester Estimated Price**: Used for new, uncataloged items.

### Real-Time Financial Ceiling Tracking
Rate contracts specify maximum cumulative financial commitments (e.g., ₹10,00,000 for `RC-2026-001`). Within a batch run, the engine tracks cumulative consumed value chronologically. When an order's value would exceed the remaining ceiling, the contract is flagged as exhausted for that order, triggering price fallback and routing the requirement to Sourcing Requests (RFQ/RFP).

### Signed Contract PDF Ingestion
In addition to standard CSV contracts, the service layer parses signed PDF contracts located in `contracts/pdf/`. Using `pdf-parse` and targeted regular expressions, the engine extracts contract identifiers, supplier IDs, financial ceilings, validity periods, and item rate schedules. For example, signed contracts `RC-2026-031` (Pneumatic Point) and `RC-2026-033` (Infoline Systems) are automatically registered and evaluated alongside standard register entries.

---

## 10. Procurement Routing and PO Consolidation

### Deterministic Routing Rules (Policy v5.0)
Based on evaluated requirement attributes, rules classify groups into standard routes:
- **Contract PO (`CONTRACT_PO`)**: Group covered by a valid, active rate contract with sufficient remaining financial ceiling.
- **Spot PO (`SPOT_PO`)**: Group value $< ₹2,00,000$, non-emergency, no active contract, standard inventory catalog item. Assigned to the Rank 1 preferred supplier.
- **Emergency PO (`EMERGENCY_PO`)**: Requisitions marked `EMERGENCY`, group value $\le ₹5,00,000$, with at least one historical purchase from an active supplier in the previous 365 days.
- **Request for Quotation (`RFQ`)**: Sourcing request with estimated group value $< ₹10,00,000$. Requires soliciting quotes from top-ranked eligible suppliers.
- **Request for Proposal (`RFP`)**: Sourcing request with estimated group value $\ge ₹10,00,000$. Formal multi-supplier proposal process.
- **Capex Sourcing (`CAPEX_SOURCING`)**: Requisitions categorized under `Capex` (regardless of value), routed to capital procurement review.
- **New Item Sourcing (`NEW_ITEM_SOURCING`)**: Uncataloged items requiring technical specifications and supplier discovery.
- **Not Processed (`NOT_PROCESSED`)**: Edge cases such as zero-quantity lines (`PR-26-00172`) flagged for manual buyer intervention.

### 24-Hour Purchase Order Consolidation (`po-consolidation.ts`)
To reduce supplier administrative overhead and shipping costs, requirement groups resulting in purchase orders (`CONTRACT_PO`, `SPOT_PO`, `EMERGENCY_PO`) are consolidated:
- **Consolidation Criteria**: Same `supplier_id`, same `plant`, and same `route`.
- **Time Window**: Requisitions created within 24 hours of the first requirement in the group.
- **Output**: Consolidated lines share a single Purchase Order number (`PO-YYYY-NNNN`), while preserving distinct line-level requirement tracking.

---

## 11. Buyer Approval and Override Handling

Automated procurement systems must accommodate edge cases, supplier capacity bottlenecks, and specialized business circumstances. Corvo provides a structured override mechanism:

1. **Buyer Workspace (`/approvals`)**: Buyers review automated decisions, inspect requirement groupings, and review the underlying policy justifications.
2. **Mandatory Justification**: A decision override requires selecting an alternative decision/route and providing a written explanation ($> 10$ characters). Empty or whitespace-only comments are rejected by Zod validation.
3. **Audit Trail Logging**: Overrides immediately create an immutable entry in the `AuditLog` collection, recording the user ID, timestamp, original decision, overridden decision, and written justification.
4. **Visual Governance Indicators**: Overridden decisions are visually badged with distinct governance indicators across all dashboard views.

---

## 12. Authentication and Role-Based Access Control

Corvo implements **Option B: Admin-controlled user creation and role assignment with secure login and NO public registration**.

### Security Architecture
- **Zero Public Registration**: There are no public registration endpoints, sign-up forms, or open registration links. All user accounts must be provisioned directly by an Administrator within the authenticated `/users` console.
- **Live Database Role Authority**: Role claims stored in JWT tokens are treated strictly as informational hints. On every authenticated request, `authMiddleware` queries the live MongoDB `User` document to verify current role permissions and confirm `isActive === true`. If an Administrator revokes access or alters a role, the change takes effect on the next request.
- **Password Security**: Passwords are cryptographically hashed using `bcrypt` (12 rounds). Plaintext passwords and hashes are strictly excluded from JSON responses (`select('-passwordHash')`).
- **Last Active Administrator Guard**: The backend programmatically prevents deleting, deactivating, or demoting the last active Administrator account, preventing administrative lockout.

### Role Responsibilities

| Responsibility / Action | Administrator | Buyer |
| :--- | :---: | :---: |
| Access Requisition Workspace & Process PR Batches | Yes | Yes |
| Conversational Chat Intake | Yes | Yes |
| View Rate Contracts & Supplier Registers | Yes | Yes |
| Submit Decision Overrides with Justifications | Yes | Yes |
| View Draft Policy Amendments & Diff Comparisons | Yes | Yes |
| Approve and Activate Policy Versions | **Yes** | No |
| Provision, Edit, or Deactivate User Accounts | **Yes** | No |
| Trigger Administrative Password Resets | **Yes** | No |
| Access Full Immutable Audit Logs | **Yes** | No |

---

## 13. Audit Logging

Every operation affecting governance, user access, policy definitions, or financial routing is recorded in the `AuditLog` collection:

- **Logged Actions**:
  - `USER_LOGIN` / `USER_LOGOUT`
  - `USER_CREATED` / `USER_UPDATED` / `USER_DEACTIVATED` / `PASSWORD_RESET`
  - `POLICY_UPLOADED` / `POLICY_APPROVED`
  - `CONTRACT_CREATED` / `CONTRACT_UPDATED`
  - `DECISION_OVERRIDE`
- **Audit Record Schema**: Each entry captures `actor` (user ID, email, role), `action`, `entity_type`, `entity_id`, `details` (including previous vs. updated attribute diffs), and ISO-8601 `timestamp`.
- **Immutability**: Audit log records cannot be modified or deleted through the API.

---

## 14. CSV Import and Export

### Import Pipeline
The batch processor accepts CSV files containing the 13 canonical columns: `pr_no`, `pr_line`, `pr_date`, `plant`, `department`, `urgency`, `item_code`, `item_description`, `quantity`, `uom`, `need_by_date`, `estimated_unit_price`, and `currency`. Parsing is handled via streaming `csv-parse` with automatic header normalization and type coercion.

### Export Pipeline
The system generates three primary submission CSV files matching the challenge requirements:
1. `corvo__run1.csv`: 186-line PR batch decisions evaluated under Corvo Procurement Policy v5.0.
2. `corvo__run2.csv`: 186-line PR batch decisions evaluated under Amended Policy v5.1.
3. `corvo__preferred.csv`: Ranked preferred suppliers for catalog items based on historical performance.

---

## 15. Error Handling and Validation

- **Perimeter Validation**: All API inputs (JSON payloads, query parameters, file uploads) are validated at the router perimeter using Zod schemas. Invalid payloads fail early with descriptive 400 Bad Request responses.
- **Typed Application Errors**: Standardized error classes (`AppError`, `ValidationError`, `AuthError`, `NotFoundError`, `ConflictError`) ensure consistent HTTP status codes and structured error responses across all routes.
- **Information Protection**: Production error handlers sanitize stack traces and internal database errors, preventing information leakage to client callers.

---

## 16. Testing Strategy

The test suite is built on Vitest and organized into three distinct testing layers:

```
tests/
├── unit/            # Algorithmic engine isolation (7 suites, 54 tests)
├── integration/     # API routes, DB persistence, and batch pipelines (7 suites, 35 tests)
└── regression/      # Worked examples & challenge compliance (1 suite, 14 tests)
```

- **Unit Tests**: Verify the mathematical correctness of individual engines (token normalization, Levenshtein distance, 14-day calendar clubbing windows, contract ceiling decrementing, AST predicate evaluation, and 5-factor supplier scoring).
- **Integration Tests**: Verify full system behavior including file upload processing, live MongoDB persistence, policy amendment diff generation, role-based access restrictions, and contract PDF text extraction.
- **Regression Tests**: Replicate the exact inputs and verify the resulting outputs for all 14 official worked procurement decisions and 3 preferred-supplier rankings documented in `Worked_Examples.pdf`.
- **Coverage Summary**: 15 test suites and 103 automated tests pass with zero failures.

---

## 17. Deployment Approach

The platform is designed as a cloud-native, stateless service architecture:

- **Frontend (Vercel)**: Next.js 14 App Router optimized for global CDN edge distribution. Prebuild hooks compile shared workspace packages before Next.js asset generation.
- **Backend (Render)**: Containerized Express API service. Cold start seeds the active policy and admin account idempotently. File uploads are buffered in memory (`multer.memoryStorage()`), ensuring complete compatibility with stateless, ephemeral container filesystems.
- **Database (MongoDB Atlas)**: Hosted MongoDB replica set with TLS encryption, role-based database authentication, and connection pooling.
- **Graceful Health Probes**: `GET /api/health` validates database connectivity and returns system status for cloud health check monitors.

---

## 18. Known Limitations and Future Improvements

An honest assessment of current technical boundaries and architectural roadmap items:

1. **PDF Text Extraction vs. Scanned Documents**: `contract.service.ts` uses `pdf-parse` for text extraction. While highly effective for digitally signed PDFs with standard text layers, scanned bitmap contracts require OCR processing (e.g., Tesseract or Google Cloud Vision).
2. **Single-Tenant Organization Model**: The current architecture assumes a single enterprise tenant with multiple plants. Expanding to multi-tenant SaaS would require adding an `organization_id` discriminator to all schemas and query filters.
3. **Interactive Supplier Portal**: Currently, RFQ and RFP routes flag requisitions for sourcing. A natural architectural extension is a dedicated supplier portal where vendors can submit bids directly into the system.
4. **Distributed Cache for Horizontal Scaling**: In a multi-instance horizontal scaling setup, real-time contract ceiling consumption across concurrent batch uploads would benefit from distributed atomic locking (e.g., Redis distributed lock) to prevent race conditions during simultaneous batch runs.
