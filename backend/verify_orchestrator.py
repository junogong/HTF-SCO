import json
from modules.orchestrator import analyze_disruption
from modules.stress_test_engine import run_stress_test

def test_orchestrator():
    print("--- Testing Orchestrator ---")
    signal = "Major fab fire at TSMC Fab 18 in Taiwan disrupts 3nm chip production."
    result = analyze_disruption(signal)
    
    print(f"Revenue at Risk: ${result['strategy']['revenue_at_risk']}")
    print("Actions Generated:")
    for action in result['actions']:
        print(f" - [{action['type']}] {action['title']}")
    
    print("\nReasoning Trace:")
    for step in result['reasoning_trace']:
        print(f" - {step['title']}: {step.get('description', '')}")

def test_stress_test():
    print("\n--- Testing Stress Test ---")
    result = run_stress_test()
    print(f"Total Revenue Exposed: ${result['total_revenue_exposed']}")
    print(f"Total Post-Mitigation: ${result['total_post_mitigation']}")
    print(f"Total Risk Reduced: ${result['total_risk_reduced']}")
    
    if result['scenarios']:
        first_scenario = result['scenarios'][0]
        print(f"\nScenario: {first_scenario['name']}")
        print(f"Revenue at Risk: ${first_scenario['revenue_at_risk']}")
        print(f"Post-Mitigation: ${first_scenario['post_mitigation_revenue']}")
        print(f"Risk Reduction: ${first_scenario['risk_reduction']}")
        print("Pre-emptive Actions:")
        for action in first_scenario.get("preemptive_actions", []):
            print(f" - {action['title']}")

if __name__ == '__main__':
    test_orchestrator()
    test_stress_test()
