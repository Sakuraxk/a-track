import importlib.util
from pathlib import Path


def _load_worker_module():
    worker_path = Path(__file__).resolve().parents[1] / "sandbox_worker" / "app.py"
    spec = importlib.util.spec_from_file_location("sandbox_worker_app_for_tests", worker_path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_worker_make_classification_accepts_sklearn_style_kwargs():
    worker = _load_worker_module()
    namespace: dict[str, object] = {}
    exec(worker._build_sandbox_datasets_script(), namespace, namespace)

    from sandbox_datasets import make_classification

    X, y = make_classification(
        n_samples=200,
        n_features=2,
        n_informative=2,
        n_redundant=0,
        n_clusters_per_class=1,
        flip_y=0.05,
        random_state=42,
    )

    assert X.shape == (200, 2)
    assert y.shape == (200,)


def test_worker_sets_matplotlib_config_dir_to_tmp():
    worker = _load_worker_module()

    assert worker.os.environ["MPLCONFIGDIR"]
    hook = worker._build_matplotlib_hook()
    assert "tempfile.gettempdir()" in hook
    assert "font_manager" in hook
    assert "Noto Sans CJK SC" in hook
