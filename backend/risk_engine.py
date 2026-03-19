"""
RAKSHAK AI Risk Engine
Real XGBoost-based risk scoring model
"""
import numpy as np
import pickle
import os
from datetime import datetime, timezone
from typing import Dict, Tuple
from schemas import RiskLevel, RiskFactors

# ── Feature Engineering ────────────────────────────────────────────────────────
def compute_timeline_score(start_date: datetime, deadline: datetime, progress_percent: float) -> float:
    """How much of timeline has passed vs how much progress made."""
    now = datetime.now(timezone.utc)
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    if start_date.tzinfo is None:
        start_date = start_date.replace(tzinfo=timezone.utc)
    
    total_duration = (deadline - start_date).total_seconds()
    elapsed = (now - start_date).total_seconds()
    
    if total_duration <= 0:
        return 1.0
    
    time_consumed_pct = min(elapsed / total_duration, 1.0)
    # If time consumed >> progress, high risk
    delay_factor = max(0, time_consumed_pct - (progress_percent / 100))
    return min(delay_factor * 1.5, 1.0)


def compute_evidence_frequency_score(last_evidence_days: float, evidence_count: int, project_age_days: float) -> float:
    """Low frequency of evidence uploads = higher risk."""
    if project_age_days <= 0:
        return 0.0
    
    # Expected: at least 1 upload per 7 days
    expected_uploads = max(1, project_age_days / 7)
    upload_ratio = min(evidence_count / expected_uploads, 1.0)
    
    # Penalty for large gaps
    gap_penalty = min(last_evidence_days / 30, 1.0)
    
    return (1 - upload_ratio) * 0.6 + gap_penalty * 0.4


def compute_budget_utilization_score(budget: float, spent: float, progress_percent: float) -> float:
    """Budget spent vs work done ratio."""
    if budget <= 0:
        return 0.0
    
    utilization = spent / budget
    expected_utilization = progress_percent / 100
    
    # Over-spending relative to progress = high risk
    if expected_utilization < 0.01:
        return utilization * 0.5
    
    ratio = utilization / expected_utilization
    
    if ratio > 1.3:  # Over 30% overspend relative to progress
        return min((ratio - 1) * 0.8, 1.0)
    elif ratio < 0.3:  # Severely underspent (possible fraud)
        return 0.4
    return 0.0


def compute_milestone_score(total_milestones: int, completed_milestones: int, overdue_milestones: int) -> float:
    """Milestone completion rate."""
    if total_milestones == 0:
        return 0.2  # No milestones defined is slightly risky
    
    completion_rate = completed_milestones / total_milestones
    overdue_rate = overdue_milestones / total_milestones
    
    return (1 - completion_rate) * 0.5 + overdue_rate * 0.5


def compute_contractor_score(contractor_risk: float, contractor_avg_delay: float) -> float:
    """Contractor historical performance."""
    normalized_delay = min(contractor_avg_delay / 180, 1.0)  # 180 days max
    return (contractor_risk / 100) * 0.6 + normalized_delay * 0.4


# ── XGBoost Model (trained or rule-based if no training data) ──────────────────
class RiskEngine:
    MODEL_PATH = "risk_model.pkl"
    
    def __init__(self):
        self.model = None
        self._load_or_create_model()
    
    def _load_or_create_model(self):
        """Load pre-trained model or create rule-based fallback."""
        if os.path.exists(self.MODEL_PATH):
            try:
                with open(self.MODEL_PATH, 'rb') as f:
                    self.model = pickle.load(f)
                print("✅ XGBoost risk model loaded from disk")
                return
            except Exception:
                pass
        
        # Create and train synthetic model
        self._train_synthetic_model()
    
    def _train_synthetic_model(self):
        """Train XGBoost on synthetic data representing governance patterns."""
        try:
            from xgboost import XGBRegressor
            
            np.random.seed(42)
            n_samples = 5000
            
            # Generate synthetic training data
            timeline_scores = np.random.beta(2, 3, n_samples)
            evidence_scores = np.random.beta(2, 3, n_samples)
            budget_scores = np.random.beta(1.5, 4, n_samples)
            milestone_scores = np.random.beta(2, 3, n_samples)
            contractor_scores = np.random.beta(2, 4, n_samples)
            
            X = np.column_stack([
                timeline_scores,
                evidence_scores,
                budget_scores,
                milestone_scores,
                contractor_scores
            ])
            
            # Risk score as weighted combination with non-linearity
            y = (
                timeline_scores * 0.30 +
                evidence_scores * 0.25 +
                budget_scores * 0.20 +
                milestone_scores * 0.15 +
                contractor_scores * 0.10
            ) * 100
            
            # Add non-linear interactions
            y += (timeline_scores * evidence_scores) * 10
            y += (milestone_scores * budget_scores) * 5
            y = np.clip(y, 0, 100)
            
            # Add noise
            noise = np.random.normal(0, 3, n_samples)
            y = np.clip(y + noise, 0, 100)
            
            self.model = XGBRegressor(
                n_estimators=200,
                max_depth=5,
                learning_rate=0.05,
                subsample=0.8,
                colsample_bytree=0.8,
                random_state=42,
                objective='reg:squarederror'
            )
            self.model.fit(X, y, eval_set=[(X, y)], verbose=False)
            
            with open(self.MODEL_PATH, 'wb') as f:
                pickle.dump(self.model, f)
            
            print("✅ XGBoost risk model trained and saved")
        
        except ImportError:
            print("⚠️ XGBoost not available, using rule-based scoring")
            self.model = None
    
    def compute_risk(
        self,
        start_date: datetime,
        deadline: datetime,
        progress_percent: float,
        last_evidence_days: float,
        evidence_count: int,
        project_age_days: float,
        budget: float,
        spent: float,
        total_milestones: int,
        completed_milestones: int,
        overdue_milestones: int,
        contractor_risk: float,
        contractor_avg_delay: float,
    ) -> Tuple[float, RiskLevel, RiskFactors]:
        
        f1 = compute_timeline_score(start_date, deadline, progress_percent)
        f2 = compute_evidence_frequency_score(last_evidence_days, evidence_count, project_age_days)
        f3 = compute_budget_utilization_score(budget, spent, progress_percent)
        f4 = compute_milestone_score(total_milestones, completed_milestones, overdue_milestones)
        f5 = compute_contractor_score(contractor_risk, contractor_avg_delay)
        
        factors = RiskFactors(
            timeline_score=round(f1 * 100, 2),
            evidence_frequency_score=round(f2 * 100, 2),
            budget_utilization_score=round(f3 * 100, 2),
            milestone_completion_score=round(f4 * 100, 2),
            contractor_history_score=round(f5 * 100, 2),
        )
        
        if self.model is not None:
            features = np.array([[f1, f2, f3, f4, f5]])
            score = float(self.model.predict(features)[0])
        else:
            # Rule-based fallback
            score = (
                f1 * 30 + f2 * 25 + f3 * 20 + f4 * 15 + f5 * 10
            )
        
        score = round(min(max(score, 0), 100), 2)
        
        if score <= 30:
            level = RiskLevel.GREEN
        elif score <= 70:
            level = RiskLevel.YELLOW
        else:
            level = RiskLevel.RED
        
        return score, level, factors


# Singleton
risk_engine = RiskEngine()
