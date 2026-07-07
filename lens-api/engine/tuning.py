"""Single source of truth for every hoisted Lens engine tunable.

This module centralizes the numeric knobs that were previously scattered across
``constants.py``, ``cta_engine.py``, and the analyzers. Every value here is a
VERBATIM move from its former home (see the migration table in the task notes):
nothing was changed, only relocated, so engine output is unaffected.

Scope notes (deliberate omissions, so future readers do not "fix" them):
  * Risk-tier severity thresholds live in ``RISK_TIER_PROFILES`` below and are
    re-exported by ``constants.DEFAULT_RISK_PROFILES`` (same object).
  * The ``.get(key, DEFAULT)`` safety-net fallbacks inside the analyzer
    ``_classify`` functions and inside ``cta_engine`` (e.g.
    ``risk_profile.get('sell_scale', 0.5)``) are left inline ON PURPOSE. They
    only fire when a tier profile is missing or malformed, and preserving that
    edge behavior verbatim matters more than consolidating them.
  * The caution-score / risk-floor constants in ``lens_output.py``, the
    diverged next-ex-date estimation in ``dividends.py``, ``DEFAULT_SETTINGS``,
    the reference ticker/sector maps, cache TTLs, and pure math constants
    (252 trading days, sqrt annualization, epsilon guards) are intentionally
    NOT hoisted here.

Bump ``TUNING_VERSION`` on any change to a value in this file.
"""

from __future__ import annotations

from dataclasses import dataclass, field

TUNING_VERSION = "1.0.0"


# ── Risk tiers (moved verbatim from constants.DEFAULT_RISK_PROFILES) ──
# Kept as plain nested dicts: risk_profile.load_risk_profile() deep-copies each
# inner dict via ``dict(v) if isinstance(v, dict)`` before mutating it, so the
# inner values must stay real ``dict`` instances (not MappingProxyType) or that
# isinstance check would fail and the copy would leak a shared reference.
RISK_TIER_PROFILES: dict[str, dict] = {
    'high': {
        'slope':         {'critical': -50, 'high': -35, 'moderate': -20},
        'volatility':    {'critical': 80,  'high': 60,  'moderate': 45},
        'concentration': {'critical': 60,  'high': 50,  'moderate': 40},
        'beta':          {'critical': 2.2, 'high': 1.6, 'moderate': 1.2},
        'performance':   {'critical': -60, 'high': -40, 'moderate': -25},
        'sell_scale': 0.25,
    },
    'regular': {
        'slope':         {'critical': -40, 'high': -28, 'moderate': -15},
        'volatility':    {'critical': 65,  'high': 50,  'moderate': 35},
        'concentration': {'critical': 50,  'high': 40,  'moderate': 30},
        'beta':          {'critical': 1.8, 'high': 1.3, 'moderate': 1.0},
        'performance':   {'critical': -50, 'high': -30, 'moderate': -18},
        'sell_scale': 0.50,
    },
    'low': {
        'slope':         {'critical': -35, 'high': -25, 'moderate': -12},
        'volatility':    {'critical': 55,  'high': 42,  'moderate': 30},
        # Concentration moderate=25 (was 20): a 20-25% single position is normal,
        # not a flag. See the original note in constants.py history.
        'concentration': {'critical': 45,  'high': 35,  'moderate': 25},
        'beta':          {'critical': 1.4, 'high': 1.1, 'moderate': 0.8},
        'performance':   {'critical': -40, 'high': -25, 'moderate': -15},
        'sell_scale': 0.10,
    },
}

# Fallback tier when settings omit risk_tier or name an unknown one. Was the
# ``'regular'`` literal in risk_profile.load_risk_profile (both the settings.get
# default and the "unknown tier" reassignment).
DEFAULT_RISK_TIER = "regular"


@dataclass(frozen=True)
class CtaPolicy:
    """CTA-engine tunables (from cta_engine.py module constants + inline literals)."""

    # ── Former module-level constants ──
    min_sell_dollars: int = 500                       # _MIN_SELL_DOLLARS
    min_position_value_for_sell: int = 1000           # _MIN_POSITION_VALUE_FOR_SELL
    min_dead_weight_value: float = 25.0               # _MIN_DEAD_WEIGHT_VALUE
    diversified_sector_count: int = 6                 # _DIVERSIFIED_SECTOR_COUNT
    concentration_dilution_factor: float = 0.75       # _CONCENTRATION_DILUTION_FACTOR
    max_total_buy_fraction_by_tier: dict = field(     # _MAX_TOTAL_BUY_FRACTION_BY_TIER
        default_factory=lambda: {'high': 0.35, 'regular': 0.30, 'low': 0.20})
    max_total_buy_fraction: float = 0.30              # _MAX_TOTAL_BUY_FRACTION
    min_buy_dollars: float = 200.0                    # _MIN_BUY_DOLLARS
    min_buy_fraction: float = 0.01                    # _MIN_BUY_FRACTION
    no_deposit_danger_weight: float = 0.30            # _NO_DEPOSIT_DANGER_WEIGHT
    no_deposit_loss_weight: float = 0.20              # _NO_DEPOSIT_LOSS_WEIGHT

    # ── Former inline literals ──
    per_cta_buy_cap_fraction: float = 0.25            # _cap_buy_amount: total_equity * 0.25
    group_buy_cap_fraction: float = 0.50             # _cap_buy_amount: total_equity * 0.50
    dominant_position_weight: float = 0.50            # ticker_weight > 0.50 (4 sites)
    conservative_large_cap_usd: int = 5_000_000_000  # _conservative_sell_blocked
    assumed_large_cap_usd: float = 100_000_000_000.0  # _conservative_sell_blocked unknown-cap
    conservative_min_sell_weight: float = 0.05       # ticker_weight < 0.05
    sell_sev_factor_critical: float = 1.0            # priority 1/2 sev_factor
    sell_sev_factor_high: float = 0.5                # priority 1/2 sev_factor
    rebalance_cap_fraction: float = 0.35             # position_value * 0.35 (priority 3/6)
    beta_buy_deposit_fraction: float = 0.10          # priority 5: 0.10 * total_equity
    sector_buy_deposit_fraction: float = 0.10        # priority 7/9: 0.10 * total_equity
    unknown_sector_infer_weight: float = 0.4         # priority 6: sw > 0.4 sector inference
    dead_weight_max_weight: float = 0.02             # priority 8/9: weight < 0.02
    underweight_min_sector_count: int = 3            # priority 9: 3 <= sector_count
    thin_sector_max_pct: int = 10                    # priority 9: sector weight < 10
    sector_deposit_denominator: float = 0.90         # priority 9: raw_deposit / 0.90
    max_diversification_ctas: int = 3                # priority 6/7/9: [:3] / cta_count >= 3
    max_buys_per_sector: int = 3                     # _dedupe_ctas per-sector cap
    dollar_rounding: int = 10                        # _round10 / _floor10 granularity
    danger_high_weight_factor: float = 0.5           # _danger_weight: 0.5 * high


@dataclass(frozen=True)
class AnalyzerBounds:
    """Hardcoded (non-fallback) logic literals inside the analyzers.

    NOTE: the ``.get(key, DEFAULT)`` fallbacks in each analyzer's ``_classify``
    are NOT here — they stay inline as edge-case safety nets. Only genuinely
    hardcoded thresholds move.
    """

    # slope.py
    slope_min_data_points: int = 30                  # _MIN_DATA_POINTS
    slope_clamp_min: float = -80.0                   # _SLOPE_CLAMP_MIN
    slope_clamp_max: float = 60.0                    # _SLOPE_CLAMP_MAX
    slope_low_ceiling: int = 5                       # _classify: annualized_pct <= 5
    slope_direction_band: int = 5                    # analyze: > 5 up / < -5 down
    slope_broad_state_ratio: float = 0.7             # analyze: down/up ratio > 0.7

    # volatility.py
    vol_min_data_points: int = 30                    # _MIN_DATA_POINTS
    vol_clamp_min: float = 0.0                        # _VOL_CLAMP_MIN
    vol_clamp_max: float = 150.0                     # _VOL_CLAMP_MAX
    vol_flag_min_weight: float = 0.15                # analyze: weight > 0.15

    # concentration.py
    winner_drift_min_weight_pct: int = 30            # analyze: weight_pct > 30
    winner_drift_multiple: float = 2.0               # analyze: drift_multiple > 2.0
    winner_drift_high_multiple: float = 2.5          # analyze: drift_multiple > 2.5
    sector_sev_high_pct: int = 60                    # analyze: heaviest_pct > 60
    sector_sev_low_pct: int = 40                     # analyze: heaviest_pct > 40
    sector_sev_single_count: int = 1                 # analyze: sector_count <= 1
    sector_sev_double_count: int = 2                 # analyze: sector_count <= 2
    sector_unknown_reliable_pct: float = 20.0        # analyze: unknown_pct <= 20.0
    index_dominance_downgrade_pct: int = 50          # analyze: index_weight_pct >= 50

    # beta.py
    beta_min_data_points: int = 10                   # _ticker_beta n < 10 / port >= 10
    beta_low_ceiling: float = 0.5                    # _classify: beta > 0.5

    # index_fund.py
    index_fund_min_weight_pct: int = 30              # analyze: weight_pct/total > 30

    # earnings.py (brief-only; does not feed CTAs or caution score)
    earnings_days_high: int = 7                      # _severity_from_days
    earnings_days_moderate: int = 14                 # _severity_from_days
    earnings_days_low: int = 30                       # _severity_from_days
    earnings_outlook_slope_beat: int = 15            # _determine_outlook: slope > 15
    earnings_outlook_vol_beat: int = 28              # _determine_outlook: vol <= 28
    earnings_outlook_slope_miss: int = -5            # _determine_outlook: slope < -5
    earnings_outlook_vol_miss: int = 40              # _determine_outlook: vol > 40


@dataclass(frozen=True)
class Tuning:
    """Top-level aggregate. Import ``TUNING`` and read the grouped namespaces."""

    version: str
    cta: CtaPolicy
    analyzers: AnalyzerBounds
    risk_tier_profiles: dict
    default_risk_tier: str


TUNING = Tuning(
    version=TUNING_VERSION,
    cta=CtaPolicy(),
    analyzers=AnalyzerBounds(),
    risk_tier_profiles=RISK_TIER_PROFILES,
    default_risk_tier=DEFAULT_RISK_TIER,
)
