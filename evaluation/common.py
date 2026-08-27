import json
from collections.abc import Iterable
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent


def load_jsonl(filename: str) -> list[dict[str, Any]]:
    path = ROOT / "datasets" / filename
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def ratio(correct: int, total: int) -> float:
    return correct / total if total else 0.0


def write_report(filename: str, payload: dict[str, Any]) -> Path:
    report_dir = ROOT / "reports"
    report_dir.mkdir(exist_ok=True)
    path = report_dir / filename
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def macro_f1(expected: Iterable[str], predicted: Iterable[str]) -> float:
    expected_list, predicted_list = list(expected), list(predicted)
    labels = sorted(set(expected_list) | set(predicted_list))
    scores: list[float] = []
    for label in labels:
        tp = sum(e == label and p == label for e, p in zip(expected_list, predicted_list))
        fp = sum(e != label and p == label for e, p in zip(expected_list, predicted_list))
        fn = sum(e == label and p != label for e, p in zip(expected_list, predicted_list))
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        scores.append(2 * precision * recall / (precision + recall) if precision + recall else 0.0)
    return sum(scores) / len(scores) if scores else 0.0


def set_f1(expected: Iterable[str], predicted: Iterable[str]) -> float:
    expected_set, predicted_set = set(expected), set(predicted)
    if not expected_set and not predicted_set:
        return 1.0
    true_positive = len(expected_set & predicted_set)
    precision = true_positive / len(predicted_set) if predicted_set else 0.0
    recall = true_positive / len(expected_set) if expected_set else 0.0
    return 2 * precision * recall / (precision + recall) if precision + recall else 0.0


def is_subsequence(expected: Iterable[str], predicted: Iterable[str]) -> bool:
    iterator = iter(predicted)
    return all(any(item == candidate for candidate in iterator) for item in expected)
