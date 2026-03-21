"""
RAKSHAK — AI Risk Engine
Real scoring system with feature explainability and trend analysis
"""
import os
import json
import pickle
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Tuple, List, Optional, Any
from dataclasses import dataclass, asdict

import numpy as np

from schemas import RiskLevel

logger = logging.getLogger("rakshak.risk")


@dataclass
class RiskFeatures:
    """Comprehensive risk factor breakdown."""
    # Timeline metrics
    delay_ratio: float  # Current vs expected progress
    days_to_deadline: int
    days_from_start: int
    timeline_pressure: float  # 0-1 scale

    # Evidence metrics
    evidence_count: int
    evidence_frequency: float  # uploads per week
    evidence_gap_days: float
    last_evidence_days: float
    evidence_compliance: float  # 0-1

    # Budget metrics
    budget_utilization: float  # spent/budget
    budget_vs_progress_ratio: float  # utilization vs completion
    budget_efficiency: float  # 0-1, higher is better
    overspend_risk: float  # 0-1

    # Milestone metrics
    milestone_completion: float  # 0-1
    overdue_milestones: int
    total_milestones: int
    milestone_delay_avg: float  # days

    # Contractor metrics
    contractor_risk: float  # 0-100
    contractor_failure_rate: float  # 0-1
    contractor_avg_delay: float  # days

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class RiskScoreResult:
    """Complete risk scoring result with explainability."""
    score: float
    level: RiskLevel
    features: RiskFeatures
    feature_weights: Dict[str, float]
    contributing_factors: List[str]
    recommendations: List[str]
    calculated_at: datetime


def compute_timeline_features(
    start_date: datetime,
    deadline: datetime,
    progress_percent: float,
    now: Optional[datetime] = None
) -> Tuple[float, float, int, int, float]:
    """
    Compute timeline-based risk features.
    Returns: (delay_ratio, timeline_pressure, days_from_start, days_to_deadline, on_schedule)
    """
    now = now or datetime.now(timezone.utc)

    # Ensure timezone-aware
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    if start_date.tzinfo is None:
        start_date = start_date.replace(tzinfo=timezone.utc)

    total_duration = (deadline - start_date).total_seconds()
    elapsed = (now - start_date).total_seconds()
    remaining = (deadline - now).total_seconds()

    if total_duration <= 0:
        return 1.0, 1.0, 0, 0, 0.0

    # Calculate expected progress
    time_consumed_pct = min(elapsed / total_duration, 1.0)
    expected_progress = time_consumed_pct * 100

    # Delay ratio: how far behind schedule
    delay_ratio = max(0, (expected_progress - progress_percent) / 100)

    # Timeline pressure: increases as deadline approaches
    if remaining < 0:
        timeline_pressure = 1.0  # Past deadline
    else:
        timeline_pressure = 1 - (remaining / total_duration)

    days_from_start = max(0, int(elapsed / 86400))
    days_to_deadline = max(-365, int(remaining / 86400))  # Cap at -365 for past deadlines

    return delay_ratio, timeline_pressure, days_from_start, days_to_deadline, expected_progress / 100


def compute_evidence_features(
    evidence_count: int,
    last_evidence_days: float,
    project_age_days: float,
    min_interval_days: int = 7
) -> Tuple[float, float, float]:
    """
    Compute evidence-based risk features.
    Returns: (frequency, compliance, gap_risk)
    """
    if project_age_days <= 0:
        return 0.0, 0.0, 1.0

    # Expected uploads: at least one per interval
    expected_uploads = max(1, project_age_days / min_interval_days)
    frequency = min(evidence_count / expected_uploads, 2.0)  # Cap at 200%

    # Compliance score (0-1)
    compliance = min(frequency, 1.0)

    # Gap risk based on last upload
    gap_risk = min(last_evidence_days / 30, 1.0)  # Max out at 30 days

    return frequency, compliance, gap_risk


def compute_budget_features(
    budget: float,
    spent: float,
    progress_percent: float,
    time_consumed_pct: float
) -> Tuple[float, float, float, float]:
    """
    Compute budget-related risk features.
    Returns: (utilization, efficiency, vs_progress_ratio, overspend_risk)
    """
    if budget <= 0:
        return 0.0, 1.0, 1.0, 0.0

    utilization = spent / budget

    if progress_percent <= 0:
        vs_progress_ratio = utilization * 2  # High risk if spending with no progress
    else:
        expected_utilization = progress_percent / 100
        vs_progress_ratio = utilization / expected_utilization if expected_utilization > 0 else utilization

    # Efficiency: how well budget is converted to progress
    if time_consumed_pct > 0:
        expected_progress = time_consumed_pct
        actual_progress = progress_percent / 100
        efficiency = actual_progress / time_consumed_pct if time_consumed_pct > 0 else 0
    else:
        efficiency = 1.0

    # Overspend risk
    if vs_progress_ratio > 1.3:
        overspend_risk = min((vs_progress_ratio - 1) / 0.7, 1.0)
    elif vs_progress_ratio < 0.3:
        overspend_risk = 0.3  # Underspend is also suspicious
    else:
        overspend_risk = 0.0

    return utilization, efficiency, vs_progress_ratio, overspend_risk


def compute_milestone_features(
    total: int,
    completed: int,
    overdue: int
) -> Tuple[float, float, float]:
    """
    Compute milestone-based risk features.
    Returns: (completion_rate, overdue_rate, health_score)
    """
    if total == 0:
        return 0.0, 0.0, 0.5  # No milestones is slightly risky

    completion_rate = completed / total
    overdue_rate = overdue / total

    # Health score: combines completion and overdue
    health = completion_rate - (overdue_rate * 0.5)

    return completion_rate, overdue_rate, max(0, health)


def compute_contractor_features(
    contractor_risk: float,
    failure_rate: float,
    avg_delay: float
) -> float:
    """Compute contractor risk component."""
    # Normalize inputs
    normalized_risk = min(contractor_risk / 100, 1.0)
    normalized_delay = min(avg_delay / 180, 1.0)  # 6 months max

    # Weighted combination
    contractor_component = (
        normalized_risk * 0.4 +
        failure_rate * 0.4 +
        normalized_delay * 0.2
    )

    return contractor_component


class RiskEngine:
    """
    Production-grade risk scoring engine.
    Combines rule-based scoring with explainability.
    """

    # Feature weights for scoring
    WEIGHTS = {
        'timeline': 0.30,
        'evidence': 0.25,
        'budget': 0.20,
        'milestones': 0.15,
        'contractor': 0.10,
    }

    def __init__(self):
        self.model = None
        self._load_or_init_model()

    def _load_or_init_model(self):
        """Load pre-trained model or initialize rule-based system."""
        model_path = "risk_model.pkl"
        if os.path.exists(model_path):
            try:
                with open(model_path, 'rb') as f:
                    self.model = pickle.load(f)
                logger.info("✅ Risk model loaded from disk")
            except Exception as e:
                logger.warning(f"Model load failed: {e}, using rule-based")
                self.model = None
        else:
            logger.info("✅ Using rule-based risk engine")
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
        contractor_failure_rate: float,
        contractor_avg_delay: float,
        now: Optional[datetime] = None
    ) -> RiskScoreResult:
        """
        Compute comprehensive risk score with full explainability.
        """
        now = now or datetime.now(timezone.utc)

        # ── Compute Features ──────────────────────────────────────────────────

        # Timeline
        delay_ratio, timeline_pressure, days_from_start, days_to_deadline, _ = \
            compute_timeline_features(start_date, deadline, progress_percent, now)

        # Evidence
        evidence_freq, evidence_compliance, evidence_gap_risk = \
            compute_evidence_features(evidence_count, last_evidence_days, project_age_days)

        # Budget
        budget_util, budget_eff, budget_vs_prog, overspend_risk = \
            compute_budget_features(budget, spent, progress_percent, timeline_pressure)

        # Milestones
        ms_completion, ms_overdue_rate, ms_health = \
            compute_milestone_features(total_milestones, completed_milestones, overdue_milestones)

        # Contractor
        contractor_component = compute_contractor_features(
            contractor_risk, contractor_failure_rate, contractor_avg_delay
        )

        # Build features object
        features = RiskFeatures(
            delay_ratio=delay_ratio,
            days_to_deadline=days_to_deadline,
            days_from_start=days_from_start,
            timeline_pressure=timeline_pressure,
            evidence_count=evidence_count,
            evidence_frequency=evidence_freq,
            evidence_gap_days=last_evidence_days,
            last_evidence_days=last_evidence_days,
            evidence_compliance=evidence_compliance,
            budget_utilization=budget_util,
            budget_vs_progress_ratio=budget_vs_prog,
            budget_efficiency=budget_eff,
            overspend_risk=overspend_risk,
            milestone_completion=ms_completion,
            overdue_milestones=overdue_milestones,
            total_milestones=total_milestones,
            milestone_delay_avg=overdue_milestones * 7 if overdue_milestones > 0 else 0,
            contractor_risk=contractor_risk,
            contractor_failure_rate=contractor_failure_rate,
            contractor_avg_delay=contractor_avg_delay,
        )

        # ── Compute Component Scores (0-100) ──────────────────────────────────

        timeline_score = min((delay_ratio * 100) + (timeline_pressure * 30), 100)

        evidence_score = (
            (1 - evidence_compliance) * 50 +
            evidence_gap_risk * 50
        )

        budget_score = (
            overspend_risk * 60 +
            (1 - budget_eff) * 40
        )

        milestone_score = (1 - ms_health) * 100

        contractor_score = contractor_component * 100

        # ── Calculate Final Score ────────────────────────────────────────────

        if self.model is not None:
            # Use ML model if available
            try:
                feature_vector = np.array([[
                    delay_ratio,
                    1 - evidence_compliance,
                    overspend_risk,
                    1 - ms_health,
                    contractor_component
                ]])
                score = float(self.model.predict(feature_vector)[0])
            except Exception as e:
                logger.warning(f"Model prediction failed: {e}, using rules")
                score = self._weighted_score(
                    timeline_score, evidence_score, budget_score,
                    milestone_score, contractor_score
                )
        else:
            score = self._weighted_score(
                timeline_score, evidence_score, budget_score,
                milestone_score, contractor_score
            )

        score = round(max(0, min(100, score)), 2)

        # ── Determine Level ───────────────────────────────────────────────────

        if score >= 70:
            level = RiskLevel.RED
        elif score >= 40:
            level = RiskLevel.YELLOW
        else:
            level = RiskLevel.GREEN

        # ── Generate Explanations ─────────────────────────────────────────────

        contributing_factors = self._get_contributing_factors(
            features, timeline_score, evidence_score, budget_score,
            milestone_score, contractor_score
        )

        recommendations = self._generate_recommendations(features, level)

        feature_weights = {
            'timeline': round(timeline_score, 2),
            'evidence': round(evidence_score, 2),
            'budget': round(budget_score, 2),
            'milestones': round(milestone_score, 2),
            'contractor': round(contractor_score, 2),
        }

        return RiskScoreResult(
            score=score,
            level=level,
            features=features,
            feature_weights=feature_weights,
            contributing_factors=contributing_factors,
            recommendations=recommendations,
            calculated_at=now
        )

    def _weighted_score(self, timeline, evidence, budget, milestones, contractor) -> float:
        """Calculate weighted risk score."""
        return (
            timeline * self.WEIGHTS['timeline'] +
            evidence * self.WEIGHTS['evidence'] +
            budget * self.WEIGHTS['budget'] +
            milestones * self.WEIGHTS['milestones'] +
            contractor * self.WEIGHTS['contractor']
        )

    def _get_contributing_factors(
        self, features: RiskFeatures,
        timeline_s: float, evidence_s: float, budget_s: float,
        milestone_s: float, contractor_s: float
    ) -> List[str]:
        """Identify top contributing risk factors."""
        factors = []

        scores = {
            'Timeline delays': timeline_s,
            'Evidence gaps': evidence_s,
            'Budget issues': budget_s,
            'Milestone delays': milestone_s,
            'Contractor performance': contractor_s
        }

        # Sort by score (highest risk first)
        for factor, score in sorted(scores.items(), key=lambda x: x[1], reverse=True):
            if score > 50:
                factors.append(f"{factor}: HIGH RISK ({score:.1f})")
            elif score > 30:
                factors.append(f"{factor}: MEDIUM RISK ({score:.1f})")

        # Add specific conditions
        if features.evidence_gap_days > 14:
            factors.append(f"No evidence for {features.evidence_gap_days:.0f} days")

        if features.days_to_deadline <= 30 and features.delay_ratio > 0.2:
            factors.append(f"Deadline approaching with {features.delay_ratio*100:.1f}% schedule delay")

        if features.overspend_risk > 0.5:
            factors.append(f"Budget overspend risk: {features.overspend_risk*100:.1f}%")

        if features.contractor_failure_rate > 0.3:
            factors.append(f"Contractor has {features.contractor_failure_rate*100:.1f}% historical failure rate")

        return factors

    def _generate_recommendations(self, features: RiskFeatures, level: RiskLevel) -> List[str]:
        """Generate actionable recommendations based on risk factors."""
        recommendations = []

        if features.evidence_gap_days > 7:
            recommendations.append(
                f"Require immediate evidence upload - last upload was {features.evidence_gap_days:.0f} days ago"
            )

        if features.delay_ratio > 0.3:
            recommendations.append(
                "Schedule emergency review - project is significantly behind timeline"
            )

        if features.budget_vs_progress_ratio > 1.3:
            recommendations.append(
                "Audit budget utilization - spending exceeds progress achieved"
            )

        if features.overdue_milestones > 0:
            recommendations.append(
                f"Review {features.overdue_milestones} overdue milestones and develop recovery plan"
            )

        if features.contractor_failure_rate > 0.2:
            recommendations.append(
                "Consider contractor performance review and potential replacement"
            )

        if level == RiskLevel.RED:
            recommendations.append("ESCALATE: Immediate intervention required from senior officials")

        return recommendations

    def compute_national_risk(self, project_scores: List[float]) -> Dict[str, Any]:
        """
        Compute aggregate national-level risk metrics.
        """
        if not project_scores:
            return {
                "national_score": 0.0,
                "integrity_score": 100.0,
                "risk_distribution": {"green": 0, "yellow": 0, "red": 0},
                "project_count": 0
            }

        scores = np.array(project_scores)

        # Distribution
        green = int(np.sum(scores < 40))
        yellow = int(np.sum((scores >= 40) & (scores < 70)))
        red = int(np.sum(scores >= 70))

        # Weighted national score (reds count double)
        weighted = np.sum(scores) + np.sum(scores[scores >= 70])
        national_score = float(weighted / (len(scores) + red))

        # Integrity is inverse of risk
        integrity = max(0, 100 - national_score)

        return {
            "national_score": round(national_score, 2),
            "integrity_score": round(integrity, 2),
            "avg_project_risk": round(float(np.mean(scores)), 2),
            "max_project_risk": round(float(np.max(scores)), 2),
            "risk_distribution": {"green": green, "yellow": yellow, "red": red},
            "project_count": len(scores),
            "high_risk_percentage": round(red / len(scores) * 100, 2)
        }


# Singleton instance
risk_engine = RiskEngine()
