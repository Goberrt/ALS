# DSS System Architecture & Visual Guide

## 🏗️ System Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    ALS GEO MAPPING SYSTEM WITH DSS                           │
└──────────────────────────────────────────────────────────────────────────────┘

┌─ DATA LAYER ─────────────────────────────────────────────────────────────────┐
│                                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Enrollments │  │   Learners  │  │ Instructors │  │ Facilities  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘         │
│         ▲               ▲               ▲               ▲                    │
│         └───────────────┼───────────────┼───────────────┘                    │
│                         │ Supabase DB   │                                    │
│                         └───────────────┘                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ▼
┌─ AGGREGATION LAYER ──────────────────────────────────────────────────────────┐
│                                                                               │
│  DSS Helper Functions (in ALS.py)                                            │
│  ┌───────────────────────────────────────────────────────────────────────┐   │
│  │ • aggregate_barangay_data()    - Collect learner statistics          │   │
│  │ • calculate_dropout_rate()     - Analyze retention                   │   │
│  │ • get_distance_to_center()     - Accessibility metrics               │   │
│  │ • count_instructors()          - Resource availability               │   │
│  │ • estimate_population()        - Community demographics              │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ▼
┌─ DSS ANALYSIS LAYER ─────────────────────────────────────────────────────────┐
│                                                                               │
│  dss_module.py: Main DSS Engines                                             │
│                                                                               │
│  ┌──────────────────────────┐  ┌──────────────────────────┐                 │
│  │ SCORING ENGINE           │  │ RECOMMENDATION ENGINE    │                 │
│  ├──────────────────────────┤  ├──────────────────────────┤                 │
│  │ Readiness (30%)          │  │ Enrollment Recs          │                 │
│  │ At-Risk (25%)            │  │ Retention Recs           │                 │
│  │ Accessibility (20%)      │  │ Resource Recs            │                 │
│  │ Demand (15%)             │  │ Intervention Recs        │                 │
│  │ Resources (10%)          │  │                          │                 │
│  │                          │  │ Outputs:                 │                 │
│  │ Output: Score (0-100)    │  │ • Priority (1-10)        │                 │
│  │ Tier: HIGH/MEDIUM/LOW    │  │ • Action items           │                 │
│  └──────────────┬───────────┘  │ • Timeline               │                 │
│                 │               │ • Expected impact        │                 │
│  ┌──────────────┴───────────┐  └──────────────┬───────────┘                 │
│  │ FORECAST ENGINE          │                 │                             │
│  ├──────────────────────────┤  ┌──────────────┴────────────┐                │
│  │ Historical Analysis      │  │ GAP ANALYZER             │                │
│  │ Trend Detection          │  ├──────────────────────────┤                │
│  │ Seasonal Patterns        │  │ Coverage % Analysis      │                │
│  │                          │  │ Unserved Population      │                │
│  │ Output:                  │  │ Accessibility Score      │                │
│  │ • 6-month prediction     │  │ Critical Gaps            │                │
│  │ • Confidence intervals   │  │                          │                │
│  │ • Trend direction        │  │ Output:                  │                │
│  └──────────────┬───────────┘  │ • Gap size               │                │
│                 │               │ • Resource needs         │                │
│                 └───────────────┼──────────────────────────┘                │
│                                 │                                           │
└─────────────────────────────────┼──────────────────────────────────────────┘
                                  ▼
┌─ API LAYER (FastAPI) ────────────────────────────────────────────────────────┐
│                                                                               │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐     │
│  │ Barangay Analysis  │  │ Recommendations    │  │ Enrollment Forecast│     │
│  │ /api/dss/barangay- │  │ /api/dss/top-      │  │ /api/dss/enrollment│     │
│  │ analysis/{name}    │  │ recommendations    │  │ -forecast/{name}   │     │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘     │
│                                                                               │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐     │
│  │ Gap Analysis       │  │ At-Risk Learners   │  │ Resource Allocation│     │
│  │ /api/dss/gap-      │  │ /api/dss/at-       │  │ /api/dss/resource- │     │
│  │ analysis/{name}    │  │ risk-learners      │  │ allocation-plan    │     │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘     │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ▼
┌─ FRONTEND LAYER ─────────────────────────────────────────────────────────────┐
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ Mapping Application (MapLibre GL)                                    │   │
│  │                                                                      │   │
│  │  ┌────────────────────────┐    ┌──────────────────────────────────┐ │   │
│  │  │   Map with Learners    │    │  DSS Panel (dss_frontend.js)     │ │   │
│  │  │   - Pins               │    │  ┌──────────────────────────────┐ │ │   │
│  │  │   - Heatmaps           │    │  │ OVERVIEW TAB                 │ │ │   │
│  │  │   - Badges             │    │  │ • Priority Score             │ │ │   │
│  │  │   - Routes             │    │  │ • Key Metrics                │ │ │   │
│  │  │                        │    │  │ • Score Breakdown            │ │ │   │
│  │  │                        │◄────┤  │ • Trend Indicators           │ │ │   │
│  │  │   Click Barangay       │    │  └──────────────────────────────┘ │ │   │
│  │  │   → Load DSS Analysis  │    │  ┌──────────────────────────────┐ │ │   │
│  │  │                        │    │  │ RECOMMENDATIONS TAB          │ │ │   │
│  │  │                        │    │  │ • Priority-ranked cards      │ │ │   │
│  │  │                        │    │  │ • Action items               │ │ │   │
│  │  │                        │    │  │ • Timeline & effort          │ │ │   │
│  │  │                        │    │  │ • Implement/Defer buttons    │ │ │   │
│  │  │                        │    │  └──────────────────────────────┘ │ │   │
│  │  │                        │    │  ┌──────────────────────────────┐ │ │   │
│  │  │                        │    │  │ FORECAST TAB                 │ │ │   │
│  │  │                        │    │  │ • 6-month predictions        │ │ │   │
│  │  │                        │    │  │ • Confidence intervals       │ │ │   │
│  │  │                        │    │  │ • Trend visualization        │ │ │   │
│  │  │                        │    │  └──────────────────────────────┘ │ │   │
│  │  │                        │    │  ┌──────────────────────────────┐ │ │   │
│  │  │                        │    │  │ GAPS TAB                     │ │ │   │
│  │  │                        │    │  │ • Coverage % analysis        │ │ │   │
│  │  │                        │    │  │ • Unserved population        │ │ │   │
│  │  │                        │    │  │ • Critical gaps              │ │ │   │
│  │  │                        │    │  │ • Accessibility score        │ │ │   │
│  │  │                        │    │  └──────────────────────────────┘ │ │   │
│  │  │                        │    │                                  │ │ │   │
│  │  │                        │    │ [Export Report] [Refresh]       │ │ │   │
│  │  │                        │    └──────────────────────────────────┘ │ │   │
│  │  │                        │                                          │ │   │
│  │  └────────────────────────┘                                          │ │   │
│  │                           styled with dss_styles.css                 │ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ▼
                            EDUCATOR DECISIONS
```

---

## 🎯 Priority Scoring Breakdown

```
PRIORITY SCORE CALCULATION
═════════════════════════════════════════════════════════════

Input Factors (Calculated per barangay):

1. ENROLLMENT READINESS (30%) ──────► 0-100 score
   └─ active_learners / population
   └─ completion_rate
   └─ average_performance

2. AT-RISK POPULATION (25%) ────────► 0-100 score
   └─ dropout_rate
   └─ at_risk_count
   └─ vulnerability_indicators

3. ACCESSIBILITY (20%) ─────────────► 0-100 score
   └─ distance_to_center (km)
   └─ population_density
   └─ transportation_available

4. COMMUNITY DEMAND (15%) ──────────► 0-100 score
   └─ survey_interest_score
   └─ population_size
   └─ past_inquiry_count

5. RESOURCE AVAILABILITY (10%) ─────► 0-100 score
   └─ instructor_count
   └─ materials_available
   └─ facility_condition
   └─ allocated_budget

═════════════════════════════════════════════════════════════

WEIGHTED CALCULATION:
Score = (R × 0.30) + (A × 0.25) + (Acc × 0.20) + (D × 0.15) + (Res × 0.10)

EXAMPLE:
Score = (80 × 0.30) + (70 × 0.25) + (60 × 0.20) + (75 × 0.15) + (50 × 0.10)
      = 24 + 17.5 + 12 + 11.25 + 5
      = 69.75 → MEDIUM PRIORITY (40-69 range)

═════════════════════════════════════════════════════════════

TIER CLASSIFICATION:

70-100  ✓ HIGH PRIORITY    (🟢 Green)
        → Requires immediate action
        → Top resource allocation
        → Critical intervention zones

40-69   ◆ MEDIUM PRIORITY  (🟡 Yellow)
        → Monitor and support
        → Consider resource allocation
        → Regular follow-up needed

0-39    ◇ LOW PRIORITY     (🔴 Red)
        → Lower priority for resources
        → Monitor for changes
        → Reassess quarterly
```

---

## 📊 Recommendation Generation Logic

```
RECOMMENDATION ENGINE FLOW
═══════════════════════════════════════════════════════════════

Input: Barangay Analysis Data
       ▼
┌──────────────────────────────────────┐
│ CONDITION CHECK                      │
└──────────────────────────────────────┘
       ▼
┌─ IF at_risk_learners > 20 ───────────────────────┐
│ THEN: Implement Targeted Retention Program       │
│ • 1-on-1 mentoring sessions                      │
│ • Peer learning groups                           │
│ • Remedial support                               │
│ Priority: 9/10                                   │
│ Timeline: Immediate, 3-month intervention        │
└──────────────────────────────────────────────────┘
       ▼
┌─ IF distance_to_center > 8km ────────────────────┐
│ THEN: Establish Mobile Learning Center           │
│ • Secure mobile equipment                        │
│ • Schedule weekly visits                         │
│ • Partner with barangay                          │
│ Priority: 8/10                                   │
│ Impact: 30-40% enrollment increase               │
└──────────────────────────────────────────────────┘
       ▼
┌─ IF survey_interest > 70% ───────────────────────┐
│ THEN: Capitalize on Community Interest           │
│ • Launch enrollment campaign                     │
│ • Hold info sessions                             │
│ • Offer flexible schedules                       │
│ Priority: 10/10                                  │
│ Impact: 50-100% enrollment increase              │
└──────────────────────────────────────────────────┘
       ▼
┌─ IF instructor_count < 2 ───────────────────────┐
│ THEN: Deploy Additional Instructor               │
│ • Post job opening                               │
│ • Assess current staff                           │
│ • Develop training program                       │
│ Priority: 9/10                                   │
│ Effort: Medium (1-2 months)                      │
└──────────────────────────────────────────────────┘
       ▼
┌─ IF enrollment_trend = "decreasing" ────────────┐
│ THEN: Reverse Enrollment Decline                │
│ • Analyze root causes                            │
│ • Remove enrollment barriers                     │
│ • Enhance program marketing                      │
│ Priority: 8/10                                   │
│ Impact: Stabilize + 10% growth                   │
└──────────────────────────────────────────────────┘
       ▼
Output: Ranked List of Recommendations (by priority)
```

---

## 📈 Enrollment Forecast Model

```
SIMPLE MOVING AVERAGE TREND ANALYSIS
════════════════════════════════════════════════════════════

Historical Data Example:
┌─────────┬──────────────┐
│ Month   │ Enrollment   │
├─────────┼──────────────┤
│ Jan     │ 35           │
│ Feb     │ 38           │
│ Mar     │ 42           │
│ Apr     │ 40           │
│ May     │ 45           │
│ Jun     │ 48           │
└─────────┴──────────────┘

TREND CALCULATION:
Average Change = (48 - 35) / (6 - 1) = 13 / 5 = 2.6 learners/month
Trend: INCREASING ↑

FORECAST (Next 6 months):
┌──────────┬──────────────┬────────────┐
│ Month    │ Prediction   │ Confidence │
├──────────┼──────────────┼────────────┤
│ Jul      │ 50           │ 90%        │
│ Aug      │ 52           │ 85%        │
│ Sep      │ 55           │ 80%        │
│ Oct      │ 57           │ 75%        │
│ Nov      │ 60           │ 70%        │
│ Dec      │ 62           │ 65%        │
└──────────┴──────────────┴────────────┘

Note: Confidence decreases with distance from current date
```

---

## 🎨 Frontend UI Layout

```
┌─────────────────────────────────────────────────────────┐
│ Mapping Application                                     │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │                                                  │  │
│  │           MAP AREA                               │  │
│  │      (with pins, heatmap, etc.)                 │  │
│  │                                                  │  │
│  │                                                  │  │
│  │                              ┌──────────────┐    │  │
│  │                              │  DSS Panel   │    │  │
│  │                              │  (400px)     │    │  │
│  │                              │   ┌────────┐ │    │  │
│  │                              │   │Overview│ │    │  │
│  │                              │   │        │ │    │  │
│  │                              │   │Priority│ │    │  │
│  │                              │   │Score   │ │    │  │
│  │                              │   └────────┘ │    │  │
│  │                              │   ┌────────┐ │    │  │
│  │                              │   │Recommend│ │    │  │
│  │                              │   │-ations  │ │    │  │
│  │                              │   └────────┘ │    │  │
│  │                              │   ┌────────┐ │    │  │
│  │                              │   │Forecast│ │    │  │
│  │                              │   └────────┘ │    │  │
│  │                              │   ┌────────┐ │    │  │
│  │                              │   │  Gaps  │ │    │  │
│  │                              │   └────────┘ │    │  │
│  │                              │   [Export]   │    │  │
│  │                              │   [Refresh]  │    │  │
│  │                              └──────────────┘    │  │
│  │                                                  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  [DSS Button] ◄─── Bottom Right Floating Button        │
│                                                         │
└─────────────────────────────────────────────────────────┘

RESPONSIVE DESIGN:
┌─ Desktop (>768px) ─────────────────────────────────┐
│ DSS Panel: Right sidebar, 400px wide                │
│ All features visible                                │
└────────────────────────────────────────────────────┘

┌─ Tablet/Mobile (<768px) ───────────────────────────┐
│ DSS Panel: Full screen width                        │
│ Stacked layout for smaller screens                  │
└────────────────────────────────────────────────────┘
```

---

## 🔄 User Workflow

```
1. OPEN MAPPING APPLICATION
   │
   ├─► View map with learner locations
   ├─► See pins/heatmaps/badges
   │
   └─► Click [DSS Button] (bottom right)
       │
       ▼
2. DSS PANEL OPENS
   │
   ├─► Overview Tab Shows:
   │   ├─ Priority score
   │   ├─ Key metrics (learners, at-risk, etc.)
   │   ├─ Trend direction (up/down/stable)
   │   └─ Score component breakdown
   │
   └─► Switch to other tabs:
       │
       ├─► RECOMMENDATIONS TAB
       │   ├─ View top 5 recommendations
       │   ├─ Read description of each
       │   ├─ See action items
       │   ├─ Understand impact & timeline
       │   └─ Click "Implement" or "Defer"
       │
       ├─► FORECAST TAB
       │   ├─ See 6-month enrollment prediction
       │   ├─ Check confidence levels
       │   ├─ Understand trend direction
       │   └─ Plan ahead based on predictions
       │
       └─► GAPS TAB
           ├─ Analyze coverage percentage
           ├─ Identify unserved population
           ├─ Check accessibility score
           ├─ Review critical gaps
           └─ Plan interventions
       │
       ▼
3. TAKE ACTION
   │
   ├─► Implement recommendations
   ├─► Mark status in DSS
   ├─► Adjust plans based on forecast
   └─► Document outcomes
       │
       ▼
4. TRACK RESULTS
   │
   ├─► Monitor effectiveness
   ├─► Compare DSS predictions vs actual
   ├─► Refine scoring weights
   └─► Improve future recommendations
       │
       ▼
5. EXPORT REPORT (optional)
   │
   └─► Download JSON report for documentation
       ├─ Complete barangay analysis
       ├─ All recommendations
       ├─ Timestamp and details
       └─ Archive for future reference
```

---

## 📊 Data Points Collected Per Barangay

```
BARANGAY DATA MODEL
═══════════════════════════════════════════════════════════

LEARNER METRICS:
├─ total_learners          Integer
├─ active_learners         Integer
├─ completed_learners      Integer
├─ at_risk_learners        Integer
├─ dropout_rate            Float (%)
└─ avg_performance         Float (0-100)

GEOGRAPHIC DATA:
├─ barangay_name           String
├─ latitude                Float
├─ longitude               Float
├─ population_density      Integer
├─ total_population        Integer
└─ distance_to_center      Float (km)

RESOURCE DATA:
├─ instructor_count        Integer
├─ materials_available     Integer
├─ facility_score          Float (0-100)
├─ budget_allocated        Float (PHP)
└─ learning_centers        Integer

DEMAND DATA:
├─ survey_interest         Float (0-100)
├─ past_inquiries          Integer
├─ enrollment_trend        String (increasing/stable/decreasing)
└─ demographics            Object

CALCULATED METRICS:
├─ readiness_score         Float (0-100)
├─ at_risk_score           Float (0-100)
├─ accessibility_score     Float (0-100)
├─ demand_score            Float (0-100)
├─ resources_score         Float (0-100)
├─ priority_score          Float (0-100)
└─ priority_tier           String (high/medium/low)
```

---

## 🎯 Success Metrics to Track

```
MEASUREMENT FRAMEWORK
═════════════════════════════════════════════════════════════

1. ADOPTION METRICS
   ├─ % of instructors using DSS monthly
   ├─ Number of recommendations viewed
   ├─ Number of recommendations acted upon
   └─ User satisfaction score

2. ACCURACY METRICS
   ├─ % of recommendations that improve outcomes
   ├─ Forecast accuracy (actual vs predicted)
   ├─ Tier classification accuracy
   └─ False positive rate

3. IMPACT METRICS
   ├─ Enrollment increase in high-priority areas
   ├─ Learner retention improvement
   ├─ Dropout rate reduction
   ├─ Resource allocation efficiency
   └─ Coverage expansion (% of population reached)

4. OPERATIONAL METRICS
   ├─ Time to decision making (before vs after DSS)
   ├─ Resource deployment efficiency
   ├─ Cost per enrolled learner
   ├─ Instructor utilization rate
   └─ Facility usage optimization

5. FINANCIAL METRICS
   ├─ ROI of DSS recommendations
   ├─ Cost savings from optimization
   ├─ Budget efficiency ratio
   └─ Cost per outcome achieved

REVIEW FREQUENCY:
├─ Weekly: Adoption metrics
├─ Monthly: Impact & accuracy metrics
└─ Quarterly: Comprehensive effectiveness review
```

---

This architecture document provides a complete visual understanding of how your DSS system works!
