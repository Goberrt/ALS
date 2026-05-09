"""
Decision Support System (DSS) Module for ALS Geo Mapping System
Provides intelligent data analysis, recommendations, and insights for enrollment optimization
"""

from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
import statistics
from pydantic import BaseModel
import json

# ==================== DATA MODELS ====================

class BarangayAnalysis(BaseModel):
    """Comprehensive analysis for a single barangay"""
    barangay_name: str
    total_learners: int
    active_learners: int
    at_risk_learners: int
    completed_learners: int
    dropout_rate: float
    avg_performance: float
    priority_score: float
    priority_tier: str  # 'high', 'medium', 'low'
    enrollment_trend: str  # 'increasing', 'stable', 'decreasing'
    key_factors: List[str]
    recommendations: List[Dict]  # Changed from List[str] to List[Dict]
    resources_needed: Dict[str, int]
    learner_demographics: Dict
    
class DSSRecommendation(BaseModel):
    """Single actionable recommendation"""
    priority: int  # 1-10, where 10 is highest
    category: str  # 'enrollment', 'retention', 'resource', 'intervention'
    barangay: str
    title: str
    description: str
    action_items: List[str]
    expected_impact: str
    estimated_effort: str  # 'low', 'medium', 'high'
    timeline: str
    target_audience: str = 'All'  # 'AF1 Learners', 'Enrolled Learners', 'All'

class EnrollmentForecast(BaseModel):
    """Enrollment prediction for future periods"""
    barangay: str
    current_enrollment: int
    forecast_months: int
    predictions: List[Dict]  # [{'month': 'Jan 2025', 'predicted_enrollment': 45, 'confidence': 0.85}]
    trend_direction: str
    seasonal_pattern: Optional[str]

class GapAnalysis(BaseModel):
    """Identifies service and coverage gaps"""
    barangay: str
    population_density: int
    current_learners: int
    estimated_out_of_school_youth: int
    coverage_percentage: float
    gap_size: int
    distance_to_nearest_center: float
    accessibility_score: float
    critical_gaps: List[str]

# ==================== SCORING ALGORITHM ====================

class DSS_ScoringEngine:
    """
    Multi-factor priority scoring system (SIMPLIFIED)
    Uses only data available in als_af1 table:
    - Readiness (40%): learner interest + completion
    - At-Risk (30%): dropout rate + at-risk count
    - Engagement (30%): total learners + active rate
    """
    
    WEIGHTS = {
        'readiness': 0.40,
        'at_risk': 0.30,
        'engagement': 0.30
    }
    
    PRIORITY_THRESHOLDS = {
        'high': 70,
        'medium': 40,
        'low': 0
    }
    
    @staticmethod
    def calculate_readiness(
        interested_count: int,
        completed_count: int,
        total_learners: int
    ) -> float:
        """
        Score based on learner interest and completion
        
        Returns: 0-100
        """
        if total_learners == 0:
            return 0
            
        # Interest rate (0-100)
        interest_rate = (interested_count / total_learners) * 100
        
        # Completion rate (0-100)
        completion_rate = (completed_count / total_learners) * 100
        
        # Combined
        readiness = (interest_rate * 0.6) + (completion_rate * 0.4)
        return min(readiness, 100)
    
    @staticmethod
    def calculate_at_risk(
        dropout_rate: float,
        at_risk_count: int,
        total_learners: int
    ) -> float:
        """
        Score based on at-risk population (higher = more at-risk learners)
        
        Returns: 0-100
        """
        if total_learners == 0:
            return 0
            
        # At-risk percentage
        at_risk_percentage = (at_risk_count / total_learners) * 100
        
        # Combine dropout rate and at-risk count
        at_risk_score = (at_risk_percentage * 0.6) + (min(dropout_rate, 100) * 0.4)
        return min(at_risk_score, 100)
    
    @staticmethod
    def calculate_engagement(
        total_learners: int,
        active_count: int
    ) -> float:
        """
        Score based on total enrollment and active participation
        
        Returns: 0-100
        """
        # Normalization: 50+ learners = 100
        learner_score = min((total_learners / 50) * 100, 100)
        
        # Active rate
        if total_learners == 0:
            active_rate = 0
        else:
            active_rate = (active_count / total_learners) * 100
        
        # Combined
        engagement = (learner_score * 0.5) + (active_rate * 0.5)
        return min(engagement, 100)
    
    @classmethod
    def calculate_priority_score(
        cls,
        readiness: float,
        at_risk: float,
        engagement: float
    ) -> Tuple[float, str]:
        """
        Combine three factors into priority score
        
        Returns: (priority_score: 0-100, priority_tier: str)
        """
        score = (
            readiness * cls.WEIGHTS['readiness'] +
            at_risk * cls.WEIGHTS['at_risk'] +
            engagement * cls.WEIGHTS['engagement']
        )
        
        # Determine tier
        if score >= cls.PRIORITY_THRESHOLDS['high']:
            tier = 'high'
        elif score >= cls.PRIORITY_THRESHOLDS['medium']:
            tier = 'medium'
        else:
            tier = 'low'
        
        return score, tier

# ==================== RECOMMENDATION ENGINE ====================

class DSS_RecommendationEngine:
    """
    Generates actionable recommendations based on analysis
    """
    
    @staticmethod
    def generate_enrollment_recommendations(
        barangay_analysis: Dict
    ) -> List[DSSRecommendation]:
        """Generate DATA-DRIVEN enrollment recommendations: specific to learner count and barrier patterns"""
        recommendations = []
        
        total = barangay_analysis.get('total_learners', 0)
        interested = barangay_analysis.get('interested_count', 0)
        completed = barangay_analysis.get('completed_learners', 0)
        barangay = barangay_analysis['barangay']
        
        # GET BARRIER CONTEXT
        barriers = barangay_analysis.get('barrier_analysis', {})
        top_barriers = barriers.get('top_barriers', [])
        distance_pct = barriers.get('distance_barrier_pct', 0)
        pwd_pct = barriers.get('pwd_pct', 0)
        four_ps_pct = barriers.get('four_ps_pct', 0)
        walking_pct = barriers.get('walking_only_pct', 0)
        
        # DYNAMIC BARRIER THRESHOLDS (scale-aware, not hardcoded)
        distance_barrier_threshold = 0.20 if total < 10 else 0.30 if total < 25 else 0.35
        # PWD: NO THRESHOLD - show recommendation if there's at least 1 PWD learner
        four_ps_opportunity_threshold = 0.20 if total < 15 else 0.25
        
        # ===== SITUATION 1: NO PROGRAM YET (total = 0) =====
        if total == 0:
            recommendations.append(DSSRecommendation(
                priority=10,
                category='enrollment',
                barangay=barangay,
                target_audience='AF1 Learners',
                title=f'Launch: Start ALS in {barangay} - needs facilitator + OSY identification',
                description='Zero learners. Execute: LGU coordination → facilitator recruitment → community mobilization.',
                action_items=[
                    "Contact barangay captain + DSWD for household targeting/OSY lists (free)",
                    "Identify AF1 facilitator locally (teacher, college grad, or trained volunteer)",
                    "Conduct community session: what barriers prevent youth from schooling?",
                    f"Target: identify 10-15 OSY candidates; aim to enroll 5-8 within 4 weeks"
                ],
                expected_impact='Initial cohort of 5-8 learners, foundation for scaling',
                estimated_effort='high',
                timeline='4 weeks: mobilization + enrollment'
            ))
        
        # ===== SITUATION 2-3: MICRO/SMALL PROGRAM (1-8 learners) - BARRIER-SPECIFIC =====
        elif 1 <= total <= 8:
            pwd_count = barriers.get('pwd_count', 0)  # Get actual PWD count, not percentage
            primary_barrier = 'distance' if distance_pct > distance_barrier_threshold else 'pwd' if pwd_count > 0 else 'generic'
            
            if interested >= max(4, total * 0.5):  # Interest-driven action
                recommendations.append(DSSRecommendation(
                    priority=10,
                    category='enrollment',
                    barangay=barangay,
                    title=f'Quick Win: Convert {interested} interested → {barangay} cohort (currently {total} enrolled)',
                    description=f'OPPORTUNITY: {interested} people expressed interest. Remove barriers and enroll quickly.',
                    action_items=[
                        f"Call each of {interested}: ask specifically what barriers prevent enrollment",
                        "Remove bottlenecks: simplify forms, eliminate waiting period, clarify schedule",
                        f"Target conservative: commit {int(interested * 0.4)} to {int(interested * 0.6)} within 3 weeks",
                        "Use current learner testimonials (1-on-1 conversations are most effective)"
                    ],
                    expected_impact=f'Add {int(interested * 0.5):.0f} learners in 3 weeks (low effort, high impact)',
                    estimated_effort='low',
                    timeline='3 weeks'
                ))
            elif primary_barrier == 'distance':
                distance_learners = int(total * distance_pct / 100) if total > 0 else 0
                recommendations.append(DSSRecommendation(
                    priority=9,
                    category='enrollment',
                    barangay=barangay,
                    title=f'Barrier Fix: Roving facilitator for {distance_learners} distance-challenged learners (>3km)',
                    description=f'Barrier data: {distance_pct:.0f}% ({distance_learners}) learners have distance barrier. Move to them.',
                    action_items=[
                        f"Identify 2-3 clustered sitios where these {distance_learners} live",
                        "Schedule 2x/week visiting (same day, different sitios) instead of requiring daily center attendance",
                        "Use roving facilitator model: 1 facilitator + materials kit, rotate schedule",
                        f"Expect: neutralize distance dropout risk for {distance_learners}, enable 3-5 more neighbor enrollments"
                    ],
                    expected_impact=f'Remove distance barrier for {distance_learners}, add 3-5 new local enrollments',
                    estimated_effort='medium',
                    timeline='2 weeks setup'
                ))
            elif primary_barrier == 'pwd':
                pwd_learners = int(total * pwd_pct / 100) if total > 0 else 0
                recommendations.append(DSSRecommendation(
                    priority=9,
                    category='enrollment',
                    barangay=barangay,
                    target_audience='AF1 Learners',
                    title=f'Accessibility: Support {pwd_learners} PWD learners with adapted materials + coordination',
                    description=f'{pwd_pct:.0f}% ({pwd_learners} learners) are PWD. Enable participation with accessibility focus.',
                    action_items=[
                        f"Assess each {pwd_learners} PWD: mobility? hearing? vision? cognitive needs?",
                        "Get simple accessibility: large print copies (from provincial office), audio recordings, or digital versions",
                        "Partner with DOLE/CHO for PWD support (health visit, mobility aids, therapy referrals)",
                        "Peer buddy: pair PWD learner with nearby learner for mutual support"
                    ],
                    expected_impact=f'Enable {pwd_learners} PWD participation, meet DepEd accessibility standards',
                    estimated_effort='medium',
                    timeline='1-2 weeks'
                ))
            else:
                recommendations.append(DSSRecommendation(
                    priority=9,
                    category='enrollment',
                    barangay=barangay,
                    title=f'Growth: LGU-led targeted recruitment to add 5-8 learners (currently {total})',
                    description='Small program. Need systematic OSY identification from LGU to grow organically.',
                    action_items=[
                        "Barangay captain: share household targeting results (where are eligible youth clustered?)",
                        "Identify 15-20 OSY candidates; visit 5-10 highest-interest households personally",
                        "Explain AF1 directly (not via flyers): time commitment, materials, career value",
                        "Remove barriers: free learning, flexible schedule, close to home"
                    ],
                    expected_impact='Grow from {total} to 10-15 learners within 4-6 weeks',
                    estimated_effort='medium',
                    timeline='4 weeks'
                ))
        
        # ===== SITUATION 4: SMALL PROGRAM (9-25 learners) =====
        elif 9 <= total <= 25:
            facilitators_needed = int(total / 15) + 1
            
            if four_ps_pct > four_ps_opportunity_threshold:
                four_ps_learners = int(total * four_ps_pct / 100)
                recommendations.append(DSSRecommendation(
                    priority=9,
                    category='enrollment',
                    barangay=barangay,
                    title=f'Leverage 4PS: Coordinate {four_ps_learners} 4PS beneficiaries for family support + referrals',
                    description=f'{four_ps_pct:.0f}% of {total} learners = {four_ps_learners} 4PS families. Use for peer recruitment + institutional backing.',
                    action_items=[
                        f"Contact municipal 4PS office: {four_ps_learners} families already in ALS",
                        "Request joint promotion: 4PS + ALS pathway = scholarship OR employment pathway",
                        "Ask 4PS to identify 10-15 new eligible families interested in ALS",
                        "Align ALS schedule with 4PS monitoring visits (monthly, predictable)"
                    ],
                    expected_impact=f'Add 8-12 new learners via 4PS institutional referral network',
                    estimated_effort='low',
                    timeline='3 weeks coordination'
                ))
            else:
                recommendations.append(DSSRecommendation(
                    priority=9,
                    category='enrollment',
                    barangay=barangay,
                    title=f'Hire: Add {facilitators_needed} facilitators to support {total} learners (currently understaffed)',
                    description=f'{total} learners need {facilitators_needed} facilitators (ratio ~15:1). Operationalize multi-shift model.',
                    action_items=[
                        f"Hire 1-2 AF1 facilitators (~₱3,000-4,000/month per person)",
                        f"Schedule: Facilitator 1 morning (5am-12pm), Facilitator 2 evening (5pm-8pm)",
                        "Cross-train: both know all learners, can cover absences",
                        f"Market expanded hours to working adults and farmers (should add {int(total * 0.2)}-{int(total * 0.3)} new bodies)"
                    ],
                    expected_impact=f'Support {int(total * 1.3)} learners with multi-shift model, prevent overcrowding',
                    estimated_effort='high',
                    timeline='Hire within 2-3 weeks'
                ))
        
        # ===== SITUATION 5: LARGE PROGRAM (26+ learners) =====
        elif total >= 26:
            facilitators_needed = int(total / 15) + 1
            recommendations.append(DSSRecommendation(
                priority=8,
                category='enrollment',
                barangay=barangay,
                title=f'Scale: {facilitators_needed} facilitators + AF2/advanced track for {completed} completers',
                description=f'{total} learners require {facilitators_needed} facilitators and progression pathway.',
                action_items=[
                    f"Hire/deploy {facilitators_needed} facilitators across 3-4 daily sessions",
                    "Train facilitator as AF2 coordinator for {completed} completers",
                    "Open AF2 track: entrepreneurship/health/livelihood based on learner interest",
                    "Use advanced learners as peer tutors (small stipend, leadership development)"
                ],
                expected_impact='Mature program with progression pathway and advanced track',
                estimated_effort='very_high',
                timeline='Phased over 4-8 weeks'
            ))
        
        # ===== ALWAYS: Completers pathway =====
        if completed > 0 and total >= 5:
            recommendations.append(DSSRecommendation(
                priority=7,
                category='enrollment',
                barangay=barangay,
                title=f'Progress: Transition {completed} completers → AF2/advanced track',
                description=f'{completed} learners finished AF1. Prevent dropout via continuation.',
                action_items=[
                    f"Survey {completed} completers: entrepreneurship, health, IT skills interest?",
                    "Offer AF2 track matching interest (easy enrollment, no re-entry exam)",
                    "Use advanced learners as peer facilitators (small incentive)"
                ],
                expected_impact=f'Keep {completed} on educational pathway, build leadership',
                estimated_effort='low',
                timeline='Within 1 month'
            ))
        
        return recommendations
    
    @staticmethod
    def generate_resource_recommendations(
        barangay_analysis: Dict
    ) -> List[DSSRecommendation]:
        """Generate PHASED, BUDGET-AWARE resource recommendations"""
        recommendations = []
        
        total = barangay_analysis.get('total_learners', 0)
        barangay = barangay_analysis['barangay']
        
        # GET BARRIER CONTEXT
        barriers = barangay_analysis.get('barrier_analysis', {})
        distance_pct = barriers.get('distance_barrier_pct', 0)
        pwd_pct = barriers.get('pwd_pct', 0)
        
        # DYNAMIC STAFFING REQUIREMENT
        facilitators_needed = 1 if total <= 8 else 2 if total <= 20 else 3 if total <= 35 else 4
        monthly_facilitator_cost = facilitators_needed * 3000  # ₱3k per person
        
        # ===== PHASE 1: STARTUP (0-8 learners) =====
        if total == 0:
            recommendations.append(DSSRecommendation(
                priority=10,
                category='resource',
                barangay=barangay,
                title='Startup: Recruit 1 AF1 facilitator + get basic materials',
                description='Zero cost from municipality needed. Free resources available from provincial office.',
                action_items=[
                    "Identify facilitator: teacher, college grad, community leader (volunteer initially)",
                    "Provincial office: get free AF1 curriculum (4 modules/workbooks)",
                    "Barangay: borrow learning space (hall, school, chapel)",
                    "Startup cost: ₱0 if volunteer; ₱1-2k/month if paid"
                ],
                expected_impact='Cost-free program launch with 1 facilitator',
                estimated_effort='low',
                timeline='2-3 weeks'
            ))
        
        elif 1 <= total <= 8:
            recommendations.append(DSSRecommendation(
                priority=9,
                category='resource',
                barangay=barangay,
                title=f'Phase 1: Support 1 facilitator + basic tracking ({total} learners)',
                description='Small program: minimal infrastructure. Focus on facilitator sustainability.',
                action_items=[
                    "Pay facilitator: ₱2-3,000/month (prioritize if growing)",
                    "Materials: free AF1 modules from provincial office + photocopies (₱200-300/month)",
                    "Tracking: simple paper forms (enrollment, attendance, assessment)",
                    f"Cost: ₱2-3k/month = ₱24-36k/year for 1 facilitator"
                ],
                expected_impact='Sustain pilot with basic operations, prepare for growth',
                estimated_effort='low',
                timeline='Ongoing'
            ))
        
        # ===== PHASE 2: GROWTH (9-25 learners) =====
        elif 9 <= total <= 25:
            primary_barrier = 'distance' if distance_pct > 0.30 else 'pwd' if pwd_pct > 0.15 else None
            
            if primary_barrier == 'distance':
                # Obstacle: geographically scattered
                recommendations.append(DSSRecommendation(
                    priority=9,
                    category='resource',
                    barangay=barangay,
                    title=f'Phase 2: Roving facilitator model + 2-3 satellite locations ({total} learners, {distance_pct:.0f}% distance)',
                    description='Distance barrier blocks growth at single center. Move to learners via rotating schedule.',
                    action_items=[
                        "Budget: ₱3-4k/month facilitator + ₱1-2k transport/materials",
                        "Set up 2-3 satellite sites (free space: barangay halls, chapels, schools)",
                        f"Schedule: rotate weekly (Day 1-2 Site A, Day 3-4 Site B, Day 5 Main center)",
                        f"Expect: reduce distance dropout 30%, enable 10-15 more enrollments"
                    ],
                    expected_impact=f'Neutralize distance barrier for {distance_pct:.0f}%, sustainable growth to 20-25 learners',
                    estimated_effort='medium',
                    timeline='1 month setup + ongoing'
                ))
            else:
                # Main center, add 2nd facilitator
                recommendations.append(DSSRecommendation(
                    priority=9,
                    category='resource',
                    barangay=barangay,
                    title=f'Phase 2: Hire 2nd facilitator + multi-shift model ({total} learners)',
                    description=f'{total} learners outgrow 1 facilitator (max 15/person ideal ratio).',
                    action_items=[
                        f"Hire 2nd facilitator: ₱3-4k/month",
                        "Split cohorts: Morning cohort (Fac 1) + Evening cohort (Fac 2)",
                        "Both facilitators know all learners (for coverage + peer learning)",
                        f"Cost: ₱6-8k/month = ₱72-96k/year for 2 facilitators + ₱3-4k materials = ₱75-100k/year total"
                    ],
                    expected_impact='Support 25+ learners with quality instruction, enable 30-40 target',
                    estimated_effort='high',
                    timeline='Hire within 2-3 weeks'
                ))
        
        # ===== PHASE 3: SCALE (26+ learners) =====
        elif total >= 26:
            recommendations.append(DSSRecommendation(
                priority=8,
                category='resource',
                barangay=barangay,
                title=f'Phase 3: Multi-facilitator team ({facilitators_needed} people) + AF2 coordinator + systems',
                description=f'{total} learners need {facilitators_needed} facilitators and formal operations structure.',
                action_items=[
                    f"Staff: {facilitators_needed} AF1 facilitators + 1 AF2 coordinator = ₱{monthly_facilitator_cost + 3000:,}/month",
                    "Systems: digital tracking (Google Forms/Spreadsheet), quarterly data audit",
                    "AF2: offer learner progression track (entrepreneurship/health/IT)",
                    "Monitoring: monthly PTA meeting + barangay coordination",
                    f"Annual budget: ₱{(monthly_facilitator_cost + 3000) * 12:,} (staff) + ₱50k (materials/office/misc) = ₱{(monthly_facilitator_cost + 3000) * 12 + 50000:,}/year"
                ],
                expected_impact='Mature program with multiple streams, progression pathways, institutional sustainability',
                estimated_effort='very_high',
                timeline='Phased hiring over 2 months'
            ))
        
        return recommendations
    
    @staticmethod
    def generate_intervention_recommendations(
        barangay_analysis: Dict
    ) -> List[DSSRecommendation]:
        """Generate ALS-specific learner support interventions based on barriers and learner needs"""
        recommendations = []
        
        total = barangay_analysis.get('total_learners', 0)
        barangay = barangay_analysis['barangay']
        
        # GET BARRIER CONTEXT
        barriers = barangay_analysis.get('barrier_analysis', {})
        distance_pct = barriers.get('distance_barrier_pct', 0)
        pwd_pct = barriers.get('pwd_pct', 0)
        four_ps_pct = barriers.get('four_ps_pct', 0)
        walking_pct = barriers.get('walking_only_pct', 0)
        accessibility_pct = barriers.get('accessibility_barrier_pct', 0)
        top_barriers = barriers.get('top_barriers', [])
        
        # ===== PRIORITY 1: DATA QUALITY (prerequisite for all interventions) =====
        # DISABLED FOR NOW - uncomment to re-enable data audit recommendations
        # if total > 0:
        #     recommendations.append(DSSRecommendation(
        #         priority=10,
        #         category='intervention',
        #         barangay=barangay,
        #         title='Data Audit: Confirm learner status accuracy in records',
        #         description='Accurate data is foundation for targeted support. Verify before implementing interventions.',
        #         action_items=[
        #             f"Audit {total} learners: enrollment status, actual attendance vs system records",
        #             "Contact at-risk learners with no recent attendance: confirm dropout or just absent?",
        #             "Document real barriers (from learners, not assumptions)",
        #             "Create verified learner profile with contact info, work schedule, family support"
        #         ],
        #         expected_impact='Clean data enables targeted, effective interventions',
        #         estimated_effort='high',
        #         timeline='Complete within 2 weeks'
        #     ))
        
        # ===== BARRIER-SPECIFIC INTERVENTIONS =====
        
        # Distance barrier
        if distance_pct > 0.20:
            distance_learners = int(total * distance_pct / 100)
            recommendations.append(DSSRecommendation(
                priority=9,
                category='intervention',
                barangay=barangay,
                target_audience='Enrolled Learners',
                title=f'Distance Problem: {distance_learners} learners >3km away - use low-cost remote support',
                description=f'{distance_pct:.0f}% face distance barrier. Use SMS/WhatsApp instead of requiring daily visits.',
                action_items=[
                    f"Set up weekly check-in (SMS free, vs daily travel = ₱50-100 cost per learner)",
                    "Provide take-home learning modules (photocopied workbooks learners complete at home)",
                    "Monthly meeting at learning center for assessment + face-to-face support",
                    "Buddy system: pair remote learner with closer one for peer support"
                ],
                expected_impact=f'Reduce distance-driven dropout for {distance_learners} learners',
                estimated_effort='low',
                timeline='Implement week 1'
            ))
        
        # PWD barrier - show if there's at least 1 PWD learner
        # Use pwd_count directly from barrier analysis (don't recalculate, to avoid math errors with mixed AF1/Enrolled pools)
        pwd_count = barriers.get('pwd_count', 0)
        if pwd_count > 0:
            recommendations.append(DSSRecommendation(
                priority=10,
                category='intervention',
                barangay=barangay,
                target_audience='Enrolled Learners',
                title=f'Accessibility: {pwd_count} PWD learners need targeted support',
                description=f'{pwd_pct:.0f}% are PWD. Modest adaptations enable participation.',
                action_items=[
                    f"Assess each {pwd_count}: mobility? sensory? communication needs?",
                    "For vision: large print (photocopier setting) or mobile reading app",
                    "For hearing: reduce noise during classes, face-to-face communication",
                    "For mobility: flexible break schedule, accessible learning space",
                    "CHO link: coordinate health support if needed"
                ],
                expected_impact=f'Enable {pwd_count} PWD participation, remove accessibility barriers',
                estimated_effort='medium',
                timeline='Assess by week 1, implement by week 2'
            ))
        
        # 4PS group
        if four_ps_pct > 0.15:
            four_ps_learners = int(total * four_ps_pct / 100)
            recommendations.append(DSSRecommendation(
                priority=8,
                category='intervention',
                barangay=barangay,
                target_audience='Enrolled Learners',
                title=f'4PS Alignment: {four_ps_learners} beneficiaries - coordinate schedule + referrals',
                description=f'{four_ps_pct:.0f}% are 4PS families. Institutional support can boost completion.',
                action_items=[
                    f"Schedule learning sessions around 4PS monitoring visits (monthly predictable)",
                    "Provide attendance letters for 4PS compliance documentation",
                    "Connect families to 4PS livelihood programs (if interested)",
                    "Monthly touchpoint: ask 4PS office about barriers, adjust support"
                ],
                expected_impact=f'Enable {four_ps_learners} 4PS learners to balance ALS + 4PS requirements',
                estimated_effort='low',
                timeline='Coordinate with 4PS office week 1'
            ))
        
        # At-risk learners
        at_risk = barangay_analysis.get('at_risk_learners', 0)
        if at_risk > 0:
            at_risk_pct = (at_risk / total * 100) if total > 0 else 0
            recommendations.append(DSSRecommendation(
                priority=9,
                category='intervention',
                barangay=barangay,
                target_audience='Enrolled Learners',
                title=f'Retention: {at_risk} at-risk learners ({at_risk_pct:.0f}%) - individualized dropout prevention',
                description='At-risk learners need specific support to prevent dropout. Customize intervention per learner.',
                action_items=[
                    f"Interview each {at_risk} at-risk learner: why at risk? (work, family, learning difficulty, health?)",
                    "Tailor support: for work conflict→flexible schedule, for learning struggle→1-on-1 tutoring, for health→medical referral",
                    "Motivate with milestone certificates (30, 60, 90 hours) not just final",
                    "Monthly checkin: has barrier improved? Does learner need different support?"
                ],
                expected_impact=f'Prevent {int(at_risk * 0.5)} of {at_risk} at-risk learners from dropping out',
                estimated_effort='high',
                timeline='Start interventions immediately, within week 1'
            ))
        
        # Walking-only learners
        if walking_pct > 0.50:
            recommendations.append(DSSRecommendation(
                priority=8,
                category='intervention',
                barangay=barangay,
                target_audience='Enrolled Learners',
                title=f'Logistics: {walking_pct:.0f}% walk - location + schedule critical for attendance',
                description='Majority walking means small logistics changes = big attendance impact.',
                action_items=[
                    "Learning center location: within 1km of majority of learners (or time to walk <30 min)",
                    "Schedule: early morning 5-6am (before household chores), evening 6-8pm (after farm work)",
                    "Avoid: midday heat, peak rainy season (flooding paths)",
                    "Marketing: emphasize \"near your barangay\" and \"free transport costs\""
                ],
                expected_impact='Improve attendance by 20-30% via location + schedule optimization',
                estimated_effort='medium',
                timeline='Finalize location/schedule within 3 weeks'
            ))
        
        # ===== AF1 CONVERSION FOCUS: Move interested → formal enrollment =====
        interested = barangay_analysis.get('interested_count', 0)
        af1_total = barangay_analysis.get('total_learners', 0)
        enrollment_from_pool = barangay_analysis.get('barrier_analysis', {}).get('from_enrollments', 0)
        af1_in_system = barangay_analysis.get('barrier_analysis', {}).get('from_af1', 0)
        
        # If there are interested AF1 learners, prioritize converting them
        if interested > 0:
            conversion_target = int(interested * 0.4)  # Conservative: expect 40% conversion
            recommendations.append(DSSRecommendation(
                priority=10,
                category='intervention',
                barangay=barangay,
                target_audience='AF1 Learners',
                title=f'AF1 Conversion: Convert {interested} interested AF1 learners → formal enrollment this month',
                description=f'{interested} people expressed interest in ALS. Move them to formal enrollment + Classroom access.',
                action_items=[
                    f"Call each of {interested} interested AF1 learners: ask \"Ready to formally enroll this week?\"",
                    "Send enrollment link + Classroom invite for those who say yes (immediate account + access)",
                    "For hesitant learners: address specific concerns (schedule? cost? family?) then re-invite",
                    f"Target: convert {conversion_target}-{int(interested * 0.6)} to formal enrollment within 3-4 weeks"
                ],
                expected_impact=f'Convert {conversion_target}-{int(interested * 0.6)} interested → formal enrollment + active learners',
                estimated_effort='low',
                timeline='Contact all {interested} within this week, enroll within 2-3 weeks'
            ))
        
        # ===== DIGITAL LEARNING STRATEGY (Classroom) - FOR ENROLLED LEARNERS ONLY =====
        # Note: These recommendations apply to formally enrolled learners (als_enrollments_approved)
        # NOT to AF1 interested learners (they need enrollment first)
        
        # For distance learners - async Classroom modules (if they're enrolled)
        if distance_pct > 0.20 and enrollment_from_pool > 0:
            distance_learners = int(total * distance_pct / 100)
            recommendations.append(DSSRecommendation(
                priority=8,
                category='intervention',
                barangay=barangay,
                target_audience='Enrolled Learners',
                title=f'Classroom for Distance Learners: Async modules for {distance_learners} enrolled learners >3km away',
                description=f'{distance_pct:.0f}% of enrolled learners face distance barrier. Classroom enables flexible self-paced learning.',
                action_items=[
                    f"Upload AF1 modules to Classroom (break into weekly lessons with deadlines)",
                    "Set 1-week deadline per module but allow flexibility for travel schedules",
                    "Use Classroom quizzes to track progress remotely (no daily travel required)",
                    "Monthly in-person session: group discussion + practical assessments only"
                ],
                expected_impact=f'Enable {distance_learners} distance learners to continue without daily travel commitment',
                estimated_effort='medium',
                timeline='Set up Classroom structure within 1-2 weeks'
            ))
        
        # For at-risk learners - progress monitoring (if enrolled)
        if at_risk > 0 and enrollment_from_pool > 0:
            recommendations.append(DSSRecommendation(
                priority=8,
                category='intervention',
                barangay=barangay,
                target_audience='Enrolled Learners',
                title=f'Early Warning System: Use Classroom quizzes to identify {at_risk} at-risk enrolled learners',
                description='Track enrolled learners\' progress via Classroom assignment scores + submission patterns to prevent dropout.',
                action_items=[
                    "Set Classroom quizzes every 2 weeks (low-stakes, for progress tracking only)",
                    "Flag enrolled learners scoring <60% for immediate 1-on-1 support before they drop out",
                    "Track submission patterns: if learner misses 2 assignments → call them same day",
                    "Use Classroom to send motivational messages + deadline reminders"
                ],
                expected_impact=f'Catch struggling enrolled learners within 2 weeks, prevent dropout before too late',
                estimated_effort='low',
                timeline='Start tracking immediately'
            ))
        
        # General Classroom operations (for enrolled learners)
        if enrollment_from_pool > 0:
            recommendations.append(DSSRecommendation(
                priority=7,
                category='intervention',
                barangay=barangay,
                target_audience='Enrolled Learners',
                title=f'Classroom Operations: Digital attendance + materials for {enrollment_from_pool} formally enrolled learners',
                description='Use Classroom to replace paper forms, centralize materials, + enable asynchronous support.',
                action_items=[
                    "Set up Classroom announcements: weekly schedule, urgent updates, learning tips",
                    "Upload all AF1 materials: workbooks, videos, reading lists (organized by module order)",
                    "Use Classroom attendance: mark present/absent digitally during/after each session",
                    "Create open Classroom assignment: learners can ask questions anytime + get responses"
                ],
                expected_impact='Reduce paper tracking, improve material accessibility, enable 24/7 Q&A for enrolled learners',
                estimated_effort='low',
                timeline='Ongoing'
            ))
        
        # For completers pathway (enrolled learners only)
        completed = barangay_analysis.get('completed_learners', 0)
        if completed > 0 and enrollment_from_pool > 0:
            recommendations.append(DSSRecommendation(
                priority=7,
                category='intervention',
                barangay=barangay,
                target_audience='Enrolled Learners',
                title=f'AF2 Pathway: Create Classroom for {completed} AF1 completers (entrepreneurship/skills)',
                description='Use Classroom for next-step learning: advanced skills, livelihood, career prep.',
                action_items=[
                    f"Survey {completed} completers: interested in entrepreneurship, health care, IT, agriculture?",
                    "Create AF2 Classroom section per track (e.g., 'AF2 Agri-Biz', 'AF2 Health Care Assistant')",
                    "Mix online modules + local mentorship (pair with local entrepreneur/health worker as guide)",
                    "Low effort: reuse Classroom templates, adapt existing materials"
                ],
                expected_impact=f'Keep {completed} completers on learning pathway, enable progression + livelihood outcomes',
                estimated_effort='medium',
                timeline='Launch AF2 Classroom within 3-4 weeks'
            ))
        
        return recommendations

# ==================== TREND & FORECAST ANALYSIS ====================

class DSS_ForecastEngine:
    """
    Generates enrollment forecasts and trend analysis
    """
    
    @staticmethod
    def simple_moving_average(data: List[int], window: int = 3) -> List[float]:
        """Calculate simple moving average"""
        if len(data) < window:
            return data
        return [sum(data[i:i+window])/window for i in range(len(data)-window+1)]
    
    @staticmethod
    def generate_schoolyear_forecast(
        learner_records: List[Dict],
        barangay: str,
        enrollment_records: List[Dict] = None,
        pwd_count: int = 0,
        four_ps_count: int = 0,
        distance_count: int = 0,
        current_date: datetime = None
    ) -> Dict:
        """
        Generate enhanced school year forecast (June 2025 - April 2026) using:
        - Real AF1 enrollment data (historical trends)
        - als_enrollments_approved data (recent interest/demand signals)
        - Demographic & barrier factors (affects dropout/completion)
        
        Args:
            learner_records: List of AF1 learner records with created_at and als_status
            barangay: Barangay name
            enrollment_records: List of enrollment form submissions (interest signals)
            pwd_count: Number of PWD learners
            four_ps_count: Number of 4PS beneficiaries
            distance_count: Number of learners >3km away
            current_date: Current date (default: today)
            
        Returns:
            Dictionary with detailed forecast including barrier-specific insights
        """
        if not current_date:
            current_date = datetime.now()
        
        enrollment_records = enrollment_records or []
        
        # Extract relevant data
        total_current = len(learner_records)
        completed_current = sum(1 for r in learner_records if r.get('als_status') == 'completed')
        at_risk_current = sum(1 for r in learner_records if r.get('dropout_reason'))
        
        # Calculate current rates
        completion_rate = (completed_current / total_current * 100) if total_current > 0 else 0
        dropout_rate = (at_risk_current / total_current * 100) if total_current > 0 else 0
        
        # ENROLLMENT VELOCITY: Use both AF1 historical + enrollment interest signals
        monthly_enrollments = {}
        for record in learner_records:
            if record.get('created_at'):
                created = record['created_at']
                if isinstance(created, str):
                    created = datetime.fromisoformat(created.replace('Z', '+00:00'))
                month_key = created.strftime('%Y-%m')
                monthly_enrollments[month_key] = monthly_enrollments.get(month_key, 0) + 1
        
        # Recent interest from enrollments_approved (shows demand pipeline)
        enrollment_velocity = len(enrollment_records) / max(1, (current_date - datetime(2025, 9, 1)).days / 30)  # Avg per month
        
        # Calculate weighted average enrollment rate
        af1_monthly_rate = sum(monthly_enrollments.values()) / max(1, len(monthly_enrollments)) if monthly_enrollments else (total_current / 7)
        
        # Blend AF1 history with current enrollment interest
        # If there's recent enrollment activity, weight it 40%, historical trend 60%
        avg_monthly_rate = (af1_monthly_rate * 0.6 + enrollment_velocity * 0.4) if enrollment_velocity > 0 else af1_monthly_rate
        
        # BARRIER-SPECIFIC ADJUSTMENTS
        # PWD learners may have different completion/dropout patterns
        pwd_dropout_adjustment = 1.0 if pwd_count == 0 else 1.1  # 10% higher dropout if 20%+ are PWD
        if pwd_count > 0:
            pwd_dropout_adjustment = 1.0 + (min(pwd_count / max(1, total_current + len(enrollment_records)), 0.5) * 0.15)  # Up to 15% adjustment
        
        # 4PS learners often have better retention (family support)
        four_ps_completion_adjustment = 1.0 if four_ps_count == 0 else 1.15  # 15% better completion if 20%+ are 4PS
        if four_ps_count > 0:
            four_ps_completion_adjustment = 1.0 + (min(four_ps_count / max(1, total_current + len(enrollment_records)), 0.4) * 0.20)  # Up to 20% boost
        
        # Distance learners may have higher dropout
        distance_dropout_adjustment = 1.0 if distance_count == 0 else 1.12
        if distance_count > 0:
            distance_dropout_adjustment = 1.0 + (min(distance_count / max(1, total_current + len(enrollment_records)), 0.5) * 0.18)
        
        # Months remaining in school year (June 2025 - April 2026)
        months_elapsed = 7  # Jun, Jul, Aug, Sep, Oct, Nov, Dec, Jan
        months_remaining = 3  # Feb, Mar, Apr
        
        # Forecast scenarios with barrier adjustments
        # Realistic: current rate continues with barrier adjustments
        realistic_additional = int(avg_monthly_rate * months_remaining)
        realistic_total = total_current + realistic_additional
        
        # Apply barrier-based adjustments to outcome rates
        adjusted_dropout_rate = min(dropout_rate * pwd_dropout_adjustment * distance_dropout_adjustment, 100)
        adjusted_completion_rate = min(completion_rate * four_ps_completion_adjustment, 100)
        
        realistic_completed = int(realistic_total * (adjusted_completion_rate / 100))
        realistic_at_risk = int(realistic_total * (adjusted_dropout_rate / 100))
        
        # Optimistic: 20% improvement + enrollment interest boost
        optimistic_dropout_rate = max(adjusted_dropout_rate * 0.75, 0)  # 25% reduction
        optimistic_completion_rate = min(adjusted_completion_rate * 1.25, 100)  # 25% improvement
        optimistic_total = int(realistic_total * 1.15)  # 15% more enrollment due to interest
        optimistic_completed = int(optimistic_total * (optimistic_completion_rate / 100))
        optimistic_at_risk = int(optimistic_total * (optimistic_dropout_rate / 100))
        
        # Pessimistic: 20% decline + barrier challenges
        pessimistic_dropout_rate = min(adjusted_dropout_rate * 1.35, 100)  # 35% increase
        pessimistic_completion_rate = max(adjusted_completion_rate * 0.75, 0)  # 25% reduction
        pessimistic_total = int(realistic_total * 0.85)  # 15% fewer enrollment
        pessimistic_completed = int(pessimistic_total * (pessimistic_completion_rate / 100))
        pessimistic_at_risk = int(pessimistic_total * (pessimistic_dropout_rate / 100))
        
        # Risk factors based on data
        risk_factors = []
        if pwd_count > (total_current * 0.15):
            risk_factors.append(f"High PWD concentration ({pwd_count} learners) may require specialized support")
        if distance_count > (total_current * 0.30):
            risk_factors.append(f"Distance barriers severe ({distance_count} learners >3km) - consider satellite centers")
        if dropout_rate > 20:
            risk_factors.append(f"Current dropout rate ({dropout_rate:.1f}%) is above normal - implement retention interventions")
        if enrollment_velocity < avg_monthly_rate * 0.5:
            risk_factors.append("New enrollment interest declining - increase community mobilization")
        
        # Opportunity factors
        opportunities = []
        if four_ps_count > (total_current * 0.20):
            opportunities.append(f"Strong 4PS representation ({four_ps_count} learners) - coordinate for family support")
        if enrollment_velocity > avg_monthly_rate:
            opportunities.append(f"Growing enrollment interest - scale up to capture {int(enrollment_velocity * 3)} new learners in final quarter")
        if len(learner_records) < 15:
            opportunities.append("Small cohort allows personalized attention - focus on quality over scale")
        
        return {
            'barangay': barangay,
            'forecast_month': 'April 2026',
            'school_year': '2025-2026',
            'data_sources': {
                'af1_records': total_current,
                'enrollment_signals': len(enrollment_records),
                'total_pool': total_current + len(enrollment_records)
            },
            
            # Current status
            'current': {
                'enrollment': total_current,
                'completed': completed_current,
                'at_risk': at_risk_current,
                'completion_rate': round(completion_rate, 1),
                'dropout_rate': round(dropout_rate, 1),
                'monthly_enrollment_velocity': round(avg_monthly_rate, 1),
                'recent_enrollment_interest': round(enrollment_velocity, 1)
            },
            
            # Barrier composition
            'barrier_composition': {
                'pwd_count': pwd_count,
                'four_ps_count': four_ps_count,
                'distance_barrier_count': distance_count,
                'affects_forecast': {
                    'pwd_adjusts_dropout': f"{round((pwd_dropout_adjustment - 1) * 100, 1)}% increase",
                    'four_ps_improves_completion': f"{round((four_ps_completion_adjustment - 1) * 100, 1)}% increase",
                    'distance_adjusts_dropout': f"{round((distance_dropout_adjustment - 1) * 100, 1)}% increase"
                }
            },
            
            # Realistic scenario
            'realistic': {
                'projected_enrollment': realistic_total,
                'projected_completed': realistic_completed,
                'projected_at_risk': realistic_at_risk,
                'new_enrollments': realistic_additional,
                'completion_rate': round(adjusted_completion_rate, 1),
                'dropout_rate': round(adjusted_dropout_rate, 1),
                'confidence': 'High (75%)',
                'scenario_description': 'Current trends continue with barrier-based outcomes'
            },
            
            # Optimistic scenario
            'optimistic': {
                'projected_enrollment': optimistic_total,
                'projected_completed': optimistic_completed,
                'projected_at_risk': optimistic_at_risk,
                'new_enrollments': optimistic_total - total_current,
                'completion_rate': round(optimistic_completion_rate, 1),
                'dropout_rate': round(optimistic_dropout_rate, 1),
                'confidence': 'Medium (60%)',
                'scenario_description': 'Enrollment interest + retention interventions succeed, barriers overcome'
            },
            
            # Pessimistic scenario
            'pessimistic': {
                'projected_enrollment': pessimistic_total,
                'projected_completed': pessimistic_completed,
                'projected_at_risk': pessimistic_at_risk,
                'new_enrollments': max(0, pessimistic_total - total_current),
                'completion_rate': round(pessimistic_completion_rate, 1),
                'dropout_rate': round(pessimistic_dropout_rate, 1),
                'confidence': 'Low (50%)',
                'scenario_description': 'Current barriers worsen, external challenges (health, family) increase dropouts'
            },
            
            # Risk & Opportunity Analysis
            'risk_factors': risk_factors if risk_factors else ['No major identified risks - program stable'],
            'opportunities': opportunities if opportunities else ['Focus on quality consolidation with current cohort'],
            
            # Recommendation
            'recommendation': {
                'primary': 'Implement targeted retention for at-risk groups' if dropout_rate > 15 else 'Leverage enrollment interest to scale responsibly',
                'barrier_focused': f"Address top barriers: PWD support ({pwd_count}), distance solutions ({distance_count}km+), 4PS coordination ({four_ps_count})",
                'monitoring': 'Track monthly enrollment velocity - if recent interest drops below 1/month, increase community mobilization'
            }
        }
    
    @staticmethod
    def forecast_enrollment(
        historical_data: List[Dict],  # [{'month': 'Jan 2024', 'enrollment': 35}, ...]
        barangay: str,
        forecast_months: int = 6
    ) -> EnrollmentForecast:
        """
        Forecast future enrollment using simple trend analysis
        """
        if not historical_data or len(historical_data) < 3:
            return EnrollmentForecast(
                barangay=barangay,
                current_enrollment=0,
                forecast_months=forecast_months,
                predictions=[],
                trend_direction='insufficient_data',
                seasonal_pattern=None
            )
        
        enrollments = [d['enrollment'] for d in historical_data]
        current_enrollment = enrollments[-1]
        
        # Calculate trend
        avg_change = (enrollments[-1] - enrollments[0]) / (len(enrollments) - 1)
        
        # Determine direction
        if avg_change > 2:
            trend_direction = 'increasing'
        elif avg_change < -2:
            trend_direction = 'decreasing'
        else:
            trend_direction = 'stable'
        
        # Generate forecast
        predictions = []
        for i in range(1, forecast_months + 1):
            predicted = current_enrollment + (avg_change * i)
            # Add confidence interval (decreases with distance)
            confidence = max(0.6, 0.95 - (i * 0.05))
            
            predictions.append({
                'month': i,
                'predicted_enrollment': max(0, int(predicted)),
                'confidence': round(confidence, 2)
            })
        
        return EnrollmentForecast(
            barangay=barangay,
            current_enrollment=current_enrollment,
            forecast_months=forecast_months,
            predictions=predictions,
            trend_direction=trend_direction,
            seasonal_pattern=None  # Could be detected with more data
        )

# ==================== GAP ANALYSIS ====================

class DSS_GapAnalyzer:
    """
    Identifies service and coverage gaps
    """
    
    @staticmethod
    def analyze_coverage_gaps(
        barangay: str,
        population: int,
        current_learners: int,
        distance_to_center_km: float,
        learning_centers_count: int = 0,
        estimated_out_of_school_rate: float = 0.30  # 30% default
    ) -> GapAnalysis:
        """
        Analyze coverage gaps in a barangay
        """
        estimated_out_of_school = int(population * estimated_out_of_school_rate)
        coverage_percentage = (current_learners / estimated_out_of_school * 100) if estimated_out_of_school > 0 else 0
        gap_size = estimated_out_of_school - current_learners
        
        # Accessibility scoring
        if distance_to_center_km > 10:
            accessibility_score = 20
        elif distance_to_center_km > 5:
            accessibility_score = 40
        elif distance_to_center_km > 2:
            accessibility_score = 70
        else:
            accessibility_score = 90
        
        critical_gaps = []
        if gap_size > 50:
            critical_gaps.append(f"Large unserved population: {gap_size} youth not in ALS")
        if distance_to_center_km > 8:
            critical_gaps.append(f"Low accessibility: {distance_to_center_km}km to nearest center")
        if coverage_percentage < 20:
            critical_gaps.append("Very low enrollment coverage (<20%)")
        if learning_centers_count == 0:
            critical_gaps.append("No learning centers in barangay")
        
        return GapAnalysis(
            barangay=barangay,
            population_density=population,
            current_learners=current_learners,
            estimated_out_of_school_youth=estimated_out_of_school,
            coverage_percentage=round(coverage_percentage, 1),
            gap_size=gap_size,
            distance_to_nearest_center=distance_to_center_km,
            accessibility_score=accessibility_score,
            critical_gaps=critical_gaps
        )

# ==================== DSS MAIN CLASS ====================

class ALS_DecisionSupportSystem:
    """
    Main DSS coordinator - orchestrates all analysis and recommendations
    """
    
    def __init__(self):
        self.scorer = DSS_ScoringEngine()
        self.recommender = DSS_RecommendationEngine()
        self.forecaster = DSS_ForecastEngine()
        self.gap_analyzer = DSS_GapAnalyzer()
    
    def analyze_barangay(
        self,
        barangay_data: Dict
    ) -> BarangayAnalysis:
        """
        Comprehensive analysis of single barangay using SIMPLIFIED scoring
        Based only on data available in als_af1 table
        """
        # Calculate component scores (SIMPLIFIED - 3 factors only)
        readiness = self.scorer.calculate_readiness(
            barangay_data.get('interested_count', 0),
            barangay_data.get('completed_learners', 0),
            barangay_data.get('total_learners', 1)
        )
        
        at_risk = self.scorer.calculate_at_risk(
            barangay_data.get('dropout_rate', 0),
            barangay_data.get('at_risk_learners', 0),
            barangay_data.get('total_learners', 1)
        )
        
        engagement = self.scorer.calculate_engagement(
            barangay_data.get('total_learners', 0),
            barangay_data.get('active_learners', 0)
        )
        
        # Calculate priority score (simplified: 3 factors)
        priority_score, priority_tier = self.scorer.calculate_priority_score(
            readiness, at_risk, engagement
        )
        
        # Generate recommendations
        recommendations = (
            self.recommender.generate_enrollment_recommendations(barangay_data) +
            # self.recommender.generate_resource_recommendations(barangay_data) +  # DISABLED: Teachers already funded by school
            self.recommender.generate_intervention_recommendations(barangay_data)
        )
        
        # Sort by priority
        recommendations.sort(key=lambda x: x.priority, reverse=True)
        
        # Get top 6 recommendations
        top_recommendations = recommendations[:6]
        
        return BarangayAnalysis(
            barangay_name=barangay_data['barangay'],
            total_learners=barangay_data.get('total_learners', 0),
            active_learners=barangay_data.get('active_learners', 0),
            at_risk_learners=barangay_data.get('at_risk_learners', 0),
            completed_learners=barangay_data.get('completed_learners', 0),
            dropout_rate=barangay_data.get('dropout_rate', 0),
            avg_performance=barangay_data.get('avg_performance', 0),
            priority_score=round(priority_score, 1),
            priority_tier=priority_tier,
            enrollment_trend=barangay_data.get('enrollment_trend', 'stable'),
            key_factors=[
                f"Readiness: {readiness:.0f}%",
                f"At-Risk: {at_risk:.0f}%",
                f"Engagement: {engagement:.0f}%"
            ],
            recommendations=[
                {
                    'priority': r.priority,
                    'title': r.title,
                    'description': r.description,
                    'action_items': r.action_items,
                    'expected_impact': r.expected_impact,
                    'estimated_effort': r.estimated_effort,
                    'timeline': r.timeline,
                    'category': r.category,
                    'target_audience': r.target_audience,
                    'audience_label': '🎓 AF1' if r.target_audience == 'AF1 Learners' else '👥 Enrolled' if r.target_audience == 'Enrolled Learners' else '🌍 All'
                }
                for r in top_recommendations
            ],
            resources_needed={},
            learner_demographics=barangay_data.get('demographics', {})
        )

# ==================== INITIALIZATION ====================

# Create global DSS instance
dss = ALS_DecisionSupportSystem()
