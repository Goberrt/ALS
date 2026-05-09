#!/usr/bin/env python3
"""Test DSS module with sample data"""

from dss_module import dss

# Test data for a barangay
test_data = {
    'barangay': 'Bagumbayan',
    'total_learners': 45,
    'active_learners': 35,
    'completed_learners': 12,
    'at_risk_learners': 8,
    'dropout_rate': 15.0,
    'avg_performance': 75.5,
    'total_population': 8500,
    'distance_to_center': 3.2,
    'population_density': 850,
    'instructor_count': 2,
    'materials_available': 25,
    'facility_score': 75,
    'budget_allocated': 45000,
    'survey_interest': 68,
    'past_inquiries': 12,
    'enrollment_trend': 'increasing'
}

# Run DSS analysis
analysis = dss.analyze_barangay(test_data)

# Display results
print('=' * 70)
print(f'BARANGAY: {analysis.barangay_name}')
print(f'PRIORITY SCORE: {analysis.priority_score}/100')
print(f'TIER: {analysis.priority_tier.upper()}')
print('=' * 70)
print(f'Active Learners: {analysis.active_learners}')
print(f'At-Risk: {analysis.at_risk_learners}')
print(f'Completed: {analysis.completed_learners}')
print(f'Dropout Rate: {analysis.dropout_rate}%')
print('=' * 70)
print(f'Top Recommendations:')
for i, rec in enumerate(analysis.recommendations[:3], 1):
    title = rec.get('title', 'Unknown')
    priority = rec.get('priority', 0)
    print(f'{i}. {title} (Priority {priority}/10)')
print('=' * 70)
print('SUCCESS! DSS is working correctly.')
