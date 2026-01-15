## 👤 My Contributions — Neel Gude

This repository is a fork of the Obsidian AI project originally created by Ameya.  
I’m adding this section to clearly highlight **my individual contributions** to the system’s architecture, decision engine, and AI integration.

### 🚀 Key Technical Contributions

- **Affordability / Decision Engine Architecture**  
  Co-designed the affordability engine responsible for computing financial health metrics and evaluating purchase feasibility.  
  Worked on:  
  - DTI calculations  
  - Savings-rate + emergency-fund metrics  
  - Expense categorization logic  
  - Purchase impact simulations  

- **Core Affordability Calculator (`affordCalculator.ts`)**  
  Contributed to the deterministic rule-based engine including:  
  - Metric computation  
  - Purchase impact modeling  
  - Rule evaluation pipeline  
  - Decision + recommendation output formats  

- **Affordability Rules Framework**  
  Helped structure the decision rules around:  
  - Risk levels  
  - Threshold checks  
  - Recommendation generation (`getFailedRuleRecommendations`)  
  - Auto-explanations for failed criteria  

- **OpenAI Integration for AI Financial Assistant**  
  Built the pipeline that combines Plaid financial data + deterministic rules + OpenAI reasoning to provide personalized financial insights and explanations.

- **Financial Health Insights Module**  
  Developed logic for computing:  
  - Monthly cash flow  
  - Recurring expense loads  
  - Spending flags  
  - “Months of safety” metric  
  These power the user-facing AI guidance.

- **System Design & Architecture**  
  Contributed to system structure, including:  
  - Decision engine flow  
  - Data models (`UserFinancialProfile`, `DebtAccount`, etc.)  
  - Output schema (`DecisionOutcome`, `ReasonCode`, `RiskLevel`)  
  - Integration between rule engine + AI layer  

- **Debugging & Rule Validation Tools**  
  Wrote debugging utilities to:  
  - Trace failed rules  
  - Inspect money operations  
  - Validate decision consistency  
  - Catch edge cases in Plaid-sourced data  

### Original Repository  
This fork is based on the original Obsidian AI repo created and maintained by Ameya.  
Link to original:(https://github.com/ameya1252/obsidian-decision-engine)

---

(Original README content from the project continues below.)


# 🔮 Obsidian Decision Engine

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)

**B2B AI Financial Decision Infrastructure for Fintech Applications**

*Deterministic math first. AI reasoning second. Always explainable.*

[Quick Start](#-quick-start) • [API Reference](#-api-reference) • [Architecture](#-architecture) • [Enterprise](#-enterprise-deployment) • [Enterprise & GTM](ENTERPRISE.md)

</div>

---

## 🎯 What is Obsidian?

Obsidian is a **decision engine**, not a chatbot. It's backend infrastructure that takes structured financial data and returns actionable, explainable decisions.

```
┌─────────────────┐     ┌──────────────────────────────────┐     ┌─────────────────┐
│  Fintech App    │────▶│    Obsidian Decision Engine      │────▶│  JSON Response  │
│  (Your Client)  │     │  • Rule-based checks             │     │  • Decision     │
└─────────────────┘     │  • Financial simulators          │     │  • Confidence   │
                        │  • AI explanation synthesis      │     │  • Explanation  │
                        └──────────────────────────────────┘     └─────────────────┘
```

### Key Differentiators

| Feature | Obsidian | Traditional Chatbots |
|---------|----------|---------------------|
| **Calculations** | Deterministic, precise | LLM-generated (hallucination risk) |
| **Explainability** | Every decision has reason codes | Black box |
| **Integration** | REST API / SDK | Widget / iframe |
| **Customization** | Full control over thresholds | Limited |
| **Compliance** | Audit trail built-in | Difficult to audit |

## 🏢 Enterprise-Ready Capabilities

- **Deterministic-first:** All calculations are math-driven; AI is used only for explanations and can be disabled per request (`include_ai_explanation=false`).
- **Auth & rate limits:** API key auth, per-key throttling via `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` with configurable key generator.
- **Health & probes:** `/health`, `/health/detailed`, `/ready`, `/live` endpoints for load balancers/Kubernetes.
- **Auditability:** Responses include `request_id`, `rules_evaluated`, timestamps, and computation time.
- **Governance:** Versioned routes (`/api/v1`), explicit reason codes, configurable thresholds in `src/config/thresholds.ts`.
- **Observability hooks:** Structured logging with request IDs; add your log sink/OTEL exporter; Prometheus `/metrics` recommended for production (see [ENTERPRISE.md](ENTERPRISE.md)).
- **Idempotency:** `X-Idempotency-Key` supported on write paths with configurable TTL (`IDEMPOTENCY_TTL_MS`).
- **Graceful degradation:** Deterministic responses still return if the LLM is unavailable or disabled.

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/obsidian-decision-engine.git
cd obsidian-decision-engine

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev
```

The server will start at `http://localhost:3000`. Visit `/docs` for interactive API documentation.

### Your First Decision

```bash
curl -X POST http://localhost:3000/api/v1/affordability \
  -H "Content-Type: application/json" \
  -d '{
    "user": {
      "monthly_income": 5200,
      "monthly_fixed_expenses": 3100,
      "cash_balance": 4200,
      "debts": [
        { "type": "credit_card", "balance": 4200, "apr": 24.99, "credit_limit": 10000 }
      ]
    },
    "purchase": {
      "amount": 1200,
      "category": "electronics",
      "payment_method": "credit_card"
    }
  }'
```

**Response:**
```json
{
  "decision": "CONDITIONAL",
  "confidence": 0.72,
  "reason_codes": ["CASHFLOW_AT_RISK", "HIGH_CREDIT_UTILIZATION"],
  "explanation": "This purchase is possible, but would strain your budget. Your credit utilization would increase to 54%, which may impact your credit score.",
  "recommended_plan": [
    "Delay purchase by 2 months",
    "Pay down $800 of credit card debt first"
  ],
  "risk_level": "MODERATE",
  "impact_analysis": {
    "projected_cash_balance": 4200,
    "months_of_buffer_remaining": 1.2,
    "credit_utilization_change": 0.12
  }
}
```

---

## 📚 API Reference

### Core Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/affordability` | POST | Can the user afford this purchase? |
| `/api/v1/debt/payoff-plan` | POST | Optimal debt payoff strategy |
| `/api/v1/next-action` | POST | Top prioritized financial actions |
| `/api/v1/health-score` | POST | Financial health grade (A-F) |

### Affordability Check

**POST** `/api/v1/affordability`

Evaluates whether a user can afford a proposed purchase.

<details>
<summary>Request Schema</summary>

```typescript
{
  user: {
    monthly_income: number;       // Required
    monthly_fixed_expenses: number; // Required
    cash_balance: number;         // Required
    savings_balance?: number;
    emergency_fund?: number;
    debts: Array<{
      type: 'credit_card' | 'personal_loan' | 'auto_loan' | 'student_loan' | 'mortgage' | 'other';
      balance: number;
      apr: number;
      minimum_payment?: number;
      credit_limit?: number;      // For credit cards
    }>;
  };
  purchase: {
    amount: number;
    category: 'electronics' | 'appliances' | 'travel' | 'luxury' | 'essential_needs' | ...;
    payment_method: 'cash' | 'credit_card' | 'financing' | 'buy_now_pay_later';
    financing_terms?: {           // If payment_method is 'financing'
      apr: number;
      term_months: number;
      down_payment?: number;
    };
  };
  include_ai_explanation?: boolean; // Default: true
}
```
</details>

<details>
<summary>Response Schema</summary>

```typescript
{
  decision: 'YES' | 'NO' | 'CONDITIONAL' | 'DEFER';
  confidence: number;             // 0.0 to 1.0
  reason_codes: string[];         // Machine-readable codes
  explanation: string;            // Human-readable explanation
  risk_level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  recommended_plan: string[];     // If decision is not YES
  impact_analysis: {
    projected_cash_balance: number;
    months_of_buffer_remaining: number;
    new_monthly_cashflow?: number;
    new_debt_to_income?: number;
    credit_utilization_change?: number;
  };
  alternatives?: Array<{
    strategy: string;
    description: string;
    savings?: number;
    timeline?: string;
  }>;
  metadata: {
    request_id: string;
    timestamp: string;
    computation_time_ms: number;
    ai_explanation_used: boolean;
  };
}
```
</details>

### Debt Payoff Plan

**POST** `/api/v1/debt/payoff-plan`

Generates optimal debt payoff strategies with month-by-month simulation.

<details>
<summary>Request Schema</summary>

```typescript
{
  user: { /* Same as affordability */ };
  extra_monthly_payment?: number;   // Additional amount to put toward debt
  strategy?: 'avalanche' | 'snowball' | 'hybrid'; // Or compare all
  include_schedule?: boolean;       // Include month-by-month breakdown
  max_months?: number;              // Maximum simulation length (default: 360)
}
```
</details>

<details>
<summary>Response Schema</summary>

```typescript
{
  recommended_strategy: 'avalanche' | 'snowball' | 'hybrid';
  recommendation_reason: string;
  strategy_comparison: Array<{
    strategy_name: string;
    total_months_to_payoff: number;
    total_interest_paid: number;
    total_amount_paid: number;
    payoff_order: Array<{ debt_id, debt_name, months_to_payoff, interest_paid }>;
  }>;
  monthly_schedule: Array<{
    month: number;
    date: string;
    payments: Array<{ debt_id, payment_amount, principal_paid, interest_paid, remaining_balance }>;
    total_remaining_debt: number;
  }>;
  insights: {
    potential_interest_savings: number;
    debt_free_date: string;
    highest_interest_debt: string;
    quick_wins: string[];
  };
}
```
</details>

### Next Best Action

**POST** `/api/v1/next-action`

Returns prioritized financial actions based on the user's situation.

<details>
<summary>Response Schema</summary>

```typescript
{
  actions: Array<{
    action_id: string;
    priority: number;           // 1 = highest
    action_type: 'pay_debt' | 'build_emergency_fund' | 'reduce_expense' | ...;
    title: string;
    description: string;
    impact: {
      monthly_savings?: number;
      total_savings?: number;
      risk_reduction?: string;
    };
    effort_level: 'low' | 'medium' | 'high';
    urgency: 'immediate' | 'this_week' | 'this_month' | 'this_quarter';
    steps: string[];
  }>;
  health_assessment: {
    score: number;              // 0-100
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    summary: string;
    strengths: string[];
    concerns: string[];
  };
  key_metrics: {
    monthly_cashflow: number;
    debt_to_income_ratio: number;
    emergency_fund_months: number;
    total_debt: number;
    savings_rate: number;
  };
}
```
</details>

---

## 🏗 Architecture

### Core Principle: Deterministic Math First

```
User Data → [Rule Engine] → [Financial Simulator] → [AI Synthesis] → Response
              100% math       100% math            Only explanations
```

The AI layer (LLM) is **only** used for natural language synthesis. All financial calculations are deterministic and auditable.

### Project Structure

```
obsidian-decision-engine/
├── src/
│   ├── api/                    # HTTP endpoints
│   │   ├── afford.ts           # Affordability endpoint
│   │   ├── debt.ts             # Debt payoff endpoint
│   │   └── nextAction.ts       # Next best action endpoint
│   │
│   ├── core/                   # Business logic (no I/O)
│   │   ├── affordability/      # Affordability calculator
│   │   ├── debt/               # Debt simulator
│   │   ├── signals/            # Financial signal detection
│   │   └── actions/            # Action recommendation engine
│   │
│   ├── ai/                     # LLM integration (explanations only)
│   │   ├── llmClient.ts        # OpenAI-compatible client
│   │   ├── reasoningPrompt.ts  # Prompt templates
│   │   └── decisionSynthesizer.ts
│   │
│   ├── models/                 # TypeScript types & schemas
│   │   ├── types.ts            # Core financial types
│   │   └── DecisionResponse.ts # Response schemas
│   │
│   ├── config/                 # Configuration
│   │   ├── thresholds.ts       # Financial thresholds
│   │   └── limits.ts           # Rate limits & constraints
│   │
│   └── utils/                  # Utility functions
│       ├── money.ts            # Precise decimal arithmetic
│       ├── dates.ts            # Date calculations
│       └── validation.ts       # Input validation
│
└── tests/                      # Test suite
```

### Key Design Decisions

1. **No Magic Numbers**: All thresholds are configurable in `/config/thresholds.ts`
2. **Precise Arithmetic**: Uses `Decimal.js` for all money calculations
3. **Schema Validation**: Zod schemas for runtime type safety
4. **Graceful Degradation**: AI unavailable? Falls back to template explanations
5. **Audit Trail**: Every response includes `request_id`, timestamps, and rules evaluated

---

## 🛡 Enterprise Deployment

### Environment Variables

```bash
# Required
NODE_ENV=production
PORT=3000
API_KEY=your-secure-api-key

# Optional: AI
OPENAI_API_KEY=sk-...
LLM_MODEL=gpt-4-turbo-preview
LLM_TEMPERATURE=0.3

# Optional: Customization
MIN_EMERGENCY_FUND_MONTHS=3
CRITICAL_DTI_RATIO=0.5
HIGH_APR_THRESHOLD=15.0
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Kubernetes Health Probes

```yaml
livenessProbe:
  httpGet:
    path: /live
    port: 3000
readinessProbe:
  httpGet:
    path: /ready
    port: 3000
```

### Rate Limiting

Default: 100 requests/minute per API key. Configure via environment:

```bash
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000
```

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/afford.test.ts
```

---

## 📊 Decision Reason Codes

| Code | Meaning |
|------|---------|
| `POSITIVE_CASHFLOW` | User has positive monthly cashflow |
| `NEGATIVE_CASHFLOW` | User is spending more than earning |
| `INSUFFICIENT_BUFFER` | Not enough emergency fund |
| `HIGH_DEBT_TO_INCOME` | DTI ratio above 43% |
| `HIGH_CREDIT_UTILIZATION` | Credit utilization above 30% |
| `EMERGENCY_FUND_INADEQUATE` | Less than 3 months expenses saved |
| `AFFORDABLE_PURCHASE` | Purchase fits within budget |
| `UNAFFORDABLE_PURCHASE` | Purchase doesn't fit budget |
| `LUXURY_WHILE_IN_DEBT` | Non-essential purchase with outstanding debt |

---

## 🛡 Security, Compliance & Operations

- **Transport & auth:** HTTPS + `X-API-Key`; rotate keys and restrict by IP/network via your gateway. mTLS/WAF/IP-allowlists recommended for production.
- **Data handling:** No persistence by default; responses include `request_id` for replay. Configure log redaction and retention (30–90 days recommended).
- **Isolation:** Deploy per tenant/namespace or VPC; apply per-key rate limits. Keep tenant-specific threshold overlays under change control.
- **SLOs:** Target 99.9% uptime; p95 latency <300ms for core endpoints under documented load. Use `/health`, `/ready`, `/live` for probes and HPA.
- **Observability:** Ship structured logs with `request_id`; add Prometheus metrics + dashboards (latency, error rate, rate-limit hits, AI fallback usage).
- **Compliance roadmap:** SOC 2 Type II prep, ISO 27001 alignment, annual third-party pen test; DPA/GDPR-ready packet. See [ENTERPRISE.md](ENTERPRISE.md) for the procurement checklist.

---

## 💰 Packaging & GTM (template)

- **Sandbox:** Limited RPS, no SLA, shared infra, AI explanations off by default.
- **Production:** Higher RPS, 99.9% uptime SLO, email support, webhooks, AI explanations on.
- **Enterprise:** Custom RPS, dedicated VPC/region, 24/7 support, custom models/prompts, security review, volume discounts, onboarding SLA.
- **Add-ons:** Dedicated cluster, premium support, custom rules library, bespoke prompts/guardrails. ROI/case study collateral recommended (see [ENTERPRISE.md](ENTERPRISE.md)).

---

## 🔌 Integration Examples

### Node.js SDK

```typescript
import { ObsidianClient } from '@obsidian/sdk';

const client = new ObsidianClient({ apiKey: 'your-key' });

const decision = await client.checkAffordability({
  user: userProfile,
  purchase: { amount: 500, category: 'electronics', payment_method: 'credit_card' }
});

if (decision.decision === 'YES') {
  // Allow purchase
} else {
  // Show recommendations
  console.log(decision.recommended_plan);
}
```

### React Native

```typescript
const checkPurchase = async (amount: number) => {
  const response = await fetch('https://api.obsidian.finance/api/v1/affordability', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify({
      user: await getUserFinancialProfile(),
      purchase: { amount, category: 'other', payment_method: 'debit' },
    }),
  });
  
  return response.json();
};
```

---

## 📜 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🤝 Support

- **Documentation**: `/docs` endpoint (Swagger UI)
- **Issues**: GitHub Issues
- **Enterprise Support**: enterprise@obsidian.finance

---

<div align="center">

**Built with 🖤 by Obsidian Financial Technologies**

*Making financial decisions transparent, explainable, and fair.*

</div>
