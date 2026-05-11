export interface PythonRuntimeAdapter {
  loadPackage(name: string | string[]): Promise<void>
  pyimport(name: string): unknown
  runPython(code: string): unknown
}

// ---------------------------------------------------------------------------
// sandbox_datasets — 内置机器学习教学数据集（纯 numpy 实现）
// 提供 load_iris / load_wine / load_digits / load_breast_cancer /
//       make_classification / make_regression
// 用法:  from sandbox_datasets import load_iris
//        data = load_iris()
//        X, y = data['data'], data['target']
// ---------------------------------------------------------------------------

export const SANDBOX_DATASETS_SCRIPT = `
import sys as _sys
import types as _types
import numpy as _np

_ds_mod = _types.ModuleType("sandbox_datasets")
_ds_mod.__path__ = []
_ds_mod.__package__ = "sandbox_datasets"
_sys.modules["sandbox_datasets"] = _ds_mod

def _make_bunch(**kwargs):
    """Simple dict-like Bunch object mimicking sklearn.utils.Bunch."""
    class Bunch(dict):
        def __init__(self, **kw):
            super().__init__(**kw)
            self.__dict__.update(kw)
    return Bunch(**kwargs)

def load_iris(return_X_y=False):
    """经典 Iris 鸢尾花数据集 (150 samples, 4 features, 3 classes)"""
    _np.random.seed(42)
    n_per_class = 50
    # 基于真实 Iris 统计特征的合成数据
    means = [[5.0, 3.4, 1.5, 0.2], [5.9, 2.8, 4.3, 1.3], [6.6, 3.0, 5.6, 2.0]]
    stds  = [[0.35, 0.38, 0.17, 0.10], [0.52, 0.31, 0.47, 0.20], [0.64, 0.32, 0.55, 0.27]]
    X_parts, y_parts = [], []
    for i in range(3):
        X_parts.append(_np.random.normal(loc=means[i], scale=stds[i], size=(n_per_class, 4)))
        y_parts.append(_np.full(n_per_class, i, dtype=_np.int64))
    X = _np.vstack(X_parts).round(1)
    y = _np.concatenate(y_parts)
    if return_X_y:
        return X, y
    return _make_bunch(
        data=X, target=y,
        feature_names=["sepal length (cm)", "sepal width (cm)", "petal length (cm)", "petal width (cm)"],
        target_names=_np.array(["setosa", "versicolor", "virginica"]),
        DESCR="Iris Plants Dataset (sandbox built-in, synthetic approximation)"
    )

def load_wine(return_X_y=False):
    """Wine 葡萄酒数据集 (178 samples, 13 features, 3 classes)"""
    _np.random.seed(42)
    counts = [59, 71, 48]
    means = [
        [13.7, 2.0, 2.5, 17.0, 106, 2.8, 3.0, 0.29, 1.9, 5.5, 1.06, 3.2, 1100],
        [12.3, 1.9, 2.2, 20.0, 95, 2.2, 2.0, 0.36, 1.6, 3.1, 1.06, 2.8, 520],
        [13.2, 3.3, 2.4, 21.0, 99, 1.7, 0.8, 0.45, 1.2, 7.4, 0.68, 1.7, 630],
    ]
    stds = [
        [0.5, 0.3, 0.2, 2.0, 12, 0.3, 0.4, 0.06, 0.4, 1.2, 0.1, 0.3, 250],
        [0.5, 0.4, 0.3, 3.0, 15, 0.5, 0.5, 0.08, 0.5, 1.0, 0.2, 0.4, 150],
        [0.7, 0.5, 0.3, 2.5, 14, 0.4, 0.3, 0.10, 0.4, 1.5, 0.1, 0.3, 200],
    ]
    X_parts, y_parts = [], []
    for i in range(3):
        X_parts.append(_np.abs(_np.random.normal(loc=means[i], scale=stds[i], size=(counts[i], 13))).round(2))
        y_parts.append(_np.full(counts[i], i, dtype=_np.int64))
    X = _np.vstack(X_parts)
    y = _np.concatenate(y_parts)
    if return_X_y:
        return X, y
    return _make_bunch(
        data=X, target=y,
        feature_names=["alcohol","malic_acid","ash","alcalinity_of_ash","magnesium","total_phenols","flavanoids","nonflavanoid_phenols","proanthocyanins","color_intensity","hue","od280/od315_of_diluted_wines","proline"],
        target_names=_np.array(["class_0", "class_1", "class_2"]),
        DESCR="Wine Dataset (sandbox built-in, synthetic approximation)"
    )

def load_digits(return_X_y=False):
    """手写数字数据集 (180 samples, 64 features, 10 classes)"""
    _np.random.seed(42)
    n_per_class = 18
    X_parts, y_parts = [], []
    for digit in range(10):
        patterns = _np.random.randint(0, 16, size=(n_per_class, 64)).astype(_np.float64)
        # 给不同数字增加一些区分度
        patterns[:, digit * 6:(digit + 1) * 6] += 8
        patterns = _np.clip(patterns, 0, 16)
        X_parts.append(patterns)
        y_parts.append(_np.full(n_per_class, digit, dtype=_np.int64))
    X = _np.vstack(X_parts)
    y = _np.concatenate(y_parts)
    if return_X_y:
        return X, y
    return _make_bunch(
        data=X, target=y,
        feature_names=[f"pixel_{i}" for i in range(64)],
        target_names=_np.arange(10),
        DESCR="Digits Dataset (sandbox built-in, synthetic approximation)"
    )

def load_breast_cancer(return_X_y=False):
    """乳腺癌数据集 (569 samples, 30 features, 2 classes)"""
    _np.random.seed(42)
    n_benign, n_malignant = 357, 212
    mean_b = [12.1, 17.5, 78.0, 460, 0.09, 0.08, 0.05, 0.03, 0.17, 0.06,
              0.3, 1.2, 2.1, 22, 0.007, 0.02, 0.03, 0.01, 0.02, 0.003,
              13.4, 23.5, 87, 560, 0.12, 0.18, 0.17, 0.07, 0.27, 0.08]
    mean_m = [17.5, 21.6, 115, 980, 0.10, 0.15, 0.16, 0.09, 0.19, 0.06,
              0.6, 1.2, 4.3, 72, 0.008, 0.03, 0.05, 0.02, 0.03, 0.004,
              21.1, 29.3, 141, 1420, 0.14, 0.35, 0.38, 0.15, 0.36, 0.09]
    std_all = [x * 0.2 for x in mean_b]
    X_b = _np.abs(_np.random.normal(loc=mean_b, scale=std_all, size=(n_benign, 30))).round(4)
    X_m = _np.abs(_np.random.normal(loc=mean_m, scale=[x * 0.15 for x in mean_m], size=(n_malignant, 30))).round(4)
    X = _np.vstack([X_m, X_b])
    y = _np.concatenate([_np.zeros(n_malignant, dtype=_np.int64), _np.ones(n_benign, dtype=_np.int64)])
    if return_X_y:
        return X, y
    return _make_bunch(
        data=X, target=y,
        feature_names=[f"feature_{i}" for i in range(30)],
        target_names=_np.array(["malignant", "benign"]),
        DESCR="Breast Cancer Dataset (sandbox built-in, synthetic approximation)"
    )

def make_classification(n_samples=100, n_features=20, n_informative=2, n_redundant=0,
                        n_repeated=0, n_classes=2, n_clusters_per_class=2,
                        weights=None, flip_y=0.0, class_sep=1.0,
                        random_state=None, shuffle=True, **kwargs):
    """生成分类任务的合成数据集"""
    if random_state is not None:
        _np.random.seed(random_state)
    n_informative = max(1, min(int(n_informative), int(n_features)))
    n_redundant = max(0, min(int(n_redundant), int(n_features) - n_informative))
    n_repeated = max(0, min(int(n_repeated), int(n_features) - n_informative - n_redundant))
    n_noise = max(0, int(n_features) - n_informative - n_redundant - n_repeated)
    if weights is None:
        weights_arr = _np.full(n_classes, 1.0 / n_classes)
    else:
        weights_arr = _np.array(weights[:n_classes], dtype=float)
        if weights_arr.size < n_classes:
            weights_arr = _np.pad(weights_arr, (0, n_classes - weights_arr.size), constant_values=max(0.0, 1.0 - weights_arr.sum()))
        weights_arr = weights_arr / weights_arr.sum() if weights_arr.sum() > 0 else _np.full(n_classes, 1.0 / n_classes)
    counts = _np.floor(weights_arr * n_samples).astype(int)
    while counts.sum() < n_samples:
        counts[int(_np.argmin(counts))] += 1
    while counts.sum() > n_samples:
        counts[int(_np.argmax(counts))] -= 1
    clusters = max(1, int(n_clusters_per_class))
    X_parts, y_parts = [], []
    for c in range(n_classes):
        for cluster in range(clusters):
            count = counts[c] // clusters + (1 if cluster < counts[c] % clusters else 0)
            if count <= 0:
                continue
            center = _np.random.randn(n_informative) * 0.6 + (c * 2 - (n_classes - 1)) * class_sep
            center += (cluster - (clusters - 1) / 2.0) * 0.8 * class_sep
            informative = _np.random.randn(count, n_informative) + center
            parts = [informative]
            if n_redundant:
                mix = _np.random.randn(n_informative, n_redundant)
                parts.append(informative @ mix / max(1, n_informative))
            if n_repeated:
                base = _np.hstack(parts)
                parts.append(base[:, _np.arange(n_repeated) % base.shape[1]])
            if n_noise:
                parts.append(_np.random.randn(count, n_noise))
            X_parts.append(_np.hstack(parts))
            y_parts.append(_np.full(count, c, dtype=_np.int64))
    X = _np.vstack(X_parts)
    y = _np.concatenate(y_parts)
    if flip_y:
        mask = _np.random.rand(len(y)) < float(flip_y)
        y[mask] = _np.random.randint(0, n_classes, size=int(mask.sum()))
    idx = _np.random.permutation(len(y)) if shuffle else _np.arange(len(y))
    return X[idx], y[idx]

def make_regression(n_samples=100, n_features=1, noise=10.0, random_state=None):
    """生成回归任务的合成数据集"""
    if random_state is not None:
        _np.random.seed(random_state)
    X = _np.random.randn(n_samples, n_features)
    coef = _np.random.randn(n_features) * 5
    y = X @ coef + noise * _np.random.randn(n_samples)
    return X, y

def make_blobs(n_samples=100, n_features=2, centers=3, cluster_std=1.0, random_state=None):
    """生成聚类任务的合成数据集"""
    if random_state is not None:
        _np.random.seed(random_state)
    if isinstance(centers, int):
        center_points = _np.random.randn(centers, n_features) * 5
    else:
        center_points = _np.array(centers)
        centers = len(center_points)
    n_per = n_samples // centers
    remainder = n_samples - n_per * centers
    X_parts, y_parts = [], []
    for c in range(centers):
        count = n_per + (1 if c < remainder else 0)
        X_parts.append(_np.random.randn(count, n_features) * cluster_std + center_points[c])
        y_parts.append(_np.full(count, c, dtype=_np.int64))
    X = _np.vstack(X_parts)
    y = _np.concatenate(y_parts)
    idx = _np.random.permutation(len(y))
    return X[idx], y[idx]

def make_moons(n_samples=100, noise=0.1, random_state=None):
    """生成双月形数据集（用于非线性聚类/分类可视化）"""
    if random_state is not None:
        _np.random.seed(random_state)
    if isinstance(n_samples, int):
        n_samples_out = n_samples // 2
        n_samples_in = n_samples - n_samples_out
    else:
        n_samples_out, n_samples_in = n_samples
    outer_circ_x = _np.cos(_np.linspace(0, _np.pi, n_samples_out))
    outer_circ_y = _np.sin(_np.linspace(0, _np.pi, n_samples_out))
    inner_circ_x = 1 - _np.cos(_np.linspace(0, _np.pi, n_samples_in))
    inner_circ_y = 1 - _np.sin(_np.linspace(0, _np.pi, n_samples_in)) - 0.5
    X = _np.vstack([
        _np.column_stack([outer_circ_x, outer_circ_y]),
        _np.column_stack([inner_circ_x, inner_circ_y]),
    ])
    y = _np.concatenate([
        _np.zeros(n_samples_out, dtype=_np.int64),
        _np.ones(n_samples_in, dtype=_np.int64),
    ])
    if noise is not None and noise > 0:
        X += _np.random.normal(scale=noise, size=X.shape)
    return X, y

def make_circles(n_samples=100, noise=0.1, factor=0.8, random_state=None):
    """生成同心圆数据集（用于非线性聚类/分类可视化）"""
    if random_state is not None:
        _np.random.seed(random_state)
    if isinstance(n_samples, int):
        n_samples_out = n_samples // 2
        n_samples_in = n_samples - n_samples_out
    else:
        n_samples_out, n_samples_in = n_samples
    linspace_out = _np.linspace(0, 2 * _np.pi, n_samples_out, endpoint=False)
    linspace_in = _np.linspace(0, 2 * _np.pi, n_samples_in, endpoint=False)
    outer_circ_x = _np.cos(linspace_out)
    outer_circ_y = _np.sin(linspace_out)
    inner_circ_x = _np.cos(linspace_in) * factor
    inner_circ_y = _np.sin(linspace_in) * factor
    X = _np.vstack([
        _np.column_stack([outer_circ_x, outer_circ_y]),
        _np.column_stack([inner_circ_x, inner_circ_y]),
    ])
    y = _np.concatenate([
        _np.zeros(n_samples_out, dtype=_np.int64),
        _np.ones(n_samples_in, dtype=_np.int64),
    ])
    if noise is not None and noise > 0:
        X += _np.random.normal(scale=noise, size=X.shape)
    return X, y

# 注册所有函数到模块
_ds_mod.load_iris = load_iris
_ds_mod.load_wine = load_wine
_ds_mod.load_digits = load_digits
_ds_mod.load_breast_cancer = load_breast_cancer
_ds_mod.make_classification = make_classification
_ds_mod.make_regression = make_regression
_ds_mod.make_blobs = make_blobs
_ds_mod.make_moons = make_moons
_ds_mod.make_circles = make_circles
`


interface MicropipLike {
  add_mock_package(name: string, version: string): void
}

export interface PythonRuntimeRequirements {
  needsMindspore: boolean
  needsTorch: boolean
  needsDatasets: boolean
  preloadPackages: string[]
}

export const MINDSPORE_LITE_SCRIPT = `
import sys as _sys
import types as _types
import numpy as _np
import mindspore as _ms

_ms.__path__ = []
_ms.__version__ = "2.2.14"

for _name, _dtype in [
    ("float16", _np.float16),
    ("float32", _np.float32),
    ("float64", _np.float64),
    ("int8", _np.int8),
    ("int16", _np.int16),
    ("int32", _np.int32),
    ("int64", _np.int64),
    ("uint8", _np.uint8),
    ("bool_", _np.bool_),
]:
    setattr(_ms, _name, _dtype)

_context = {"device_target": "CPU", "mode": 0}

def set_context(**kwargs):
    _context.update(kwargs)

def get_context(attr=None):
    return _context.get(attr) if attr else dict(_context)

_ms.set_context = set_context
_ms.get_context = get_context

def _to_numpy(value):
    if isinstance(value, Tensor):
        return value._data
    return _np.array(value)

def _normalize_index(index):
    if isinstance(index, Tensor):
        return index._data
    if isinstance(index, tuple):
        return tuple(_normalize_index(item) for item in index)
    return index

class Tensor:
    __array_priority__ = 1000

    def __init__(self, data=None, dtype=None):
        self._data = _np.array(_to_numpy(data), dtype=dtype) if dtype is not None else _np.array(_to_numpy(data))

    @property
    def shape(self):
        return self._data.shape

    @property
    def size(self):
        return self._data.size

    @property
    def ndim(self):
        return self._data.ndim

    @property
    def dtype(self):
        return str(self._data.dtype)

    @property
    def T(self):
        return Tensor(self._data.T)

    def reshape(self, *shape):
        if len(shape) == 1 and isinstance(shape[0], (tuple, list)):
            shape = tuple(shape[0])
        return Tensor(self._data.reshape(*shape))

    def asnumpy(self):
        return self._data.copy()

    def astype(self, dtype):
        return Tensor(self._data.astype(dtype), dtype=dtype)

    def item(self):
        return self._data.item()

    def __len__(self):
        return len(self._data)

    def __getitem__(self, index):
        return Tensor(self._data[_normalize_index(index)])

    def __repr__(self):
        return f"Tensor(shape={self.shape}, dtype={self.dtype}, value=\\n{self._data})"

    __str__ = __repr__

    def _binary(self, other, op):
        return Tensor(op(self._data, _to_numpy(other)))

    def __add__(self, other):
        return self._binary(other, lambda a, b: a + b)

    def __radd__(self, other):
        return Tensor(_to_numpy(other) + self._data)

    def __sub__(self, other):
        return self._binary(other, lambda a, b: a - b)

    def __rsub__(self, other):
        return Tensor(_to_numpy(other) - self._data)

    def __mul__(self, other):
        return self._binary(other, lambda a, b: a * b)

    def __rmul__(self, other):
        return Tensor(_to_numpy(other) * self._data)

    def __truediv__(self, other):
        return self._binary(other, lambda a, b: a / b)

    def __matmul__(self, other):
        return Tensor(_np.matmul(self._data, _to_numpy(other)))

    def __gt__(self, other):
        return self._binary(other, lambda a, b: a > b)

    def __ge__(self, other):
        return self._binary(other, lambda a, b: a >= b)

    def __lt__(self, other):
        return self._binary(other, lambda a, b: a < b)

    def __le__(self, other):
        return self._binary(other, lambda a, b: a <= b)

    def __eq__(self, other):
        return self._binary(other, lambda a, b: a == b)

    def __ne__(self, other):
        return self._binary(other, lambda a, b: a != b)

class Parameter(Tensor):
    def __init__(self, default_input, name="", requires_grad=True):
        super().__init__(default_input)
        self.name = name
        self.requires_grad = requires_grad

class Cell:
    def __init__(self):
        object.__setattr__(self, "_params", {})
        object.__setattr__(self, "_cells", {})
        object.__setattr__(self, "training", True)

    def __setattr__(self, name, value):
        object.__setattr__(self, name, value)
        if name in {"_params", "_cells", "training"}:
            return
        if isinstance(value, Parameter):
            self._params[name] = value
        elif isinstance(value, Cell):
            self._cells[name] = value

    def construct(self, *args, **kwargs):
        raise NotImplementedError

    def __call__(self, *args, **kwargs):
        return self.construct(*args, **kwargs)

    def set_train(self, mode=True):
        self.training = mode
        for _cell in self._cells.values():
            _cell.set_train(mode)
        return self

    def trainable_params(self):
        _items = list(self._params.values())
        for _cell in self._cells.values():
            _items.extend(_cell.trainable_params())
        return _items

    def parameters_and_names(self, prefix=""):
        _items = []
        for _name, _param in self._params.items():
            _items.append((f"{prefix}{_name}", _param))
        for _name, _cell in self._cells.items():
            _items.extend(_cell.parameters_and_names(f"{prefix}{_name}."))
        return _items

class GradOperation:
    def __init__(self, get_all=False, get_by_list=False, epsilon=1e-4):
        self.get_all = get_all
        self.get_by_list = get_by_list
        self.epsilon = epsilon

    def __call__(self, fn, params=None):
        def _grad_wrapper(*inputs):
            if self.get_by_list and params is not None:
                _param_gradients = []

                for _param in params:
                    _base_array = _to_numpy(_param).astype(_np.float64)
                    _base_dtype = _to_numpy(_param).dtype
                    _grad_array = _np.zeros_like(_base_array, dtype=_np.float64)
                    _iterator = _np.nditer(_base_array, flags=["multi_index"], op_flags=["readwrite"])

                    while not _iterator.finished:
                        _idx = _iterator.multi_index
                        _original = _param._data.copy()
                        _plus = _base_array.copy()
                        _minus = _base_array.copy()
                        _plus[_idx] += self.epsilon
                        _minus[_idx] -= self.epsilon

                        _param._data = _plus.astype(_base_dtype)
                        _plus_output = _to_numpy(fn(*inputs)).astype(_np.float64)
                        _param._data = _minus.astype(_base_dtype)
                        _minus_output = _to_numpy(fn(*inputs)).astype(_np.float64)
                        _param._data = _original

                        _grad_array[_idx] = (_np.sum(_plus_output) - _np.sum(_minus_output)) / (2 * self.epsilon)
                        _iterator.iternext()

                    _param_gradients.append(Tensor(_grad_array.astype(_base_dtype)))

                return tuple(_param_gradients)

            gradients = []

            for _input_index, _input_value in enumerate(inputs):
                _base_array = _to_numpy(_input_value).astype(_np.float64)
                _base_dtype = _to_numpy(_input_value).dtype
                _grad_array = _np.zeros_like(_base_array, dtype=_np.float64)
                _iterator = _np.nditer(_base_array, flags=["multi_index"], op_flags=["readwrite"])

                while not _iterator.finished:
                    _idx = _iterator.multi_index
                    _plus = _base_array.copy()
                    _minus = _base_array.copy()
                    _plus[_idx] += self.epsilon
                    _minus[_idx] -= self.epsilon

                    _plus_inputs = list(inputs)
                    _minus_inputs = list(inputs)
                    _plus_inputs[_input_index] = Tensor(_plus.astype(_base_dtype))
                    _minus_inputs[_input_index] = Tensor(_minus.astype(_base_dtype))

                    _plus_output = _to_numpy(fn(*_plus_inputs)).astype(_np.float64)
                    _minus_output = _to_numpy(fn(*_minus_inputs)).astype(_np.float64)
                    _grad_array[_idx] = (_np.sum(_plus_output) - _np.sum(_minus_output)) / (2 * self.epsilon)
                    _iterator.iternext()

                gradients.append(Tensor(_grad_array.astype(_base_dtype)))

            if self.get_all:
                return gradients[0] if len(gradients) == 1 else tuple(gradients)
            return gradients[0]

        return _grad_wrapper

def _ensure_submodule(parent, full_name):
    module = _sys.modules.get(full_name)
    if module is None:
        module = _types.ModuleType(full_name)
        module.__path__ = []
        module.__package__ = full_name
        _sys.modules[full_name] = module
        setattr(parent, full_name.split(".")[-1], module)
    return module

_context_mod = _ensure_submodule(_ms, "mindspore.context")
_context_mod.set_context = set_context
_context_mod.get_context = get_context
_context_mod.PYNATIVE_MODE = 1
_context_mod.GRAPH_MODE = 0

_common_mod = _ensure_submodule(_ms, "mindspore.common")
_common_tensor_mod = _ensure_submodule(_common_mod, "mindspore.common.tensor")
_common_mod.Tensor = Tensor
_common_mod.Parameter = Parameter
_common_tensor_mod.Tensor = Tensor

_nn_mod = _ensure_submodule(_ms, "mindspore.nn")
_nn_mod.Cell = Cell

_ops_mod = _ensure_submodule(_ms, "mindspore.ops")
_ops_functional_mod = _ensure_submodule(_ops_mod, "mindspore.ops.functional")
_ops_mod.GradOperation = GradOperation

def zeros(shape, dtype=_np.float32):
    return Tensor(_np.zeros(shape, dtype=dtype))

def ones(shape, dtype=_np.float32):
    return Tensor(_np.ones(shape, dtype=dtype))

def arange(start, stop=None, step=1, dtype=None):
    if stop is None:
        return Tensor(_np.arange(start, dtype=dtype))
    return Tensor(_np.arange(start, stop, step, dtype=dtype))

def matmul(a, b):
    return Tensor(_np.matmul(_to_numpy(a), _to_numpy(b)))

def reduce_sum(x, axis=None):
    return Tensor(_np.sum(_to_numpy(x), axis=axis))

def reduce_mean(x, axis=None):
    return Tensor(_np.mean(_to_numpy(x), axis=axis))

def reshape(x, shape):
    return Tensor(_np.reshape(_to_numpy(x), shape))

def transpose(x, axes=None):
    return Tensor(_np.transpose(_to_numpy(x), axes=axes))

def expand_dims(x, axis):
    return Tensor(_np.expand_dims(_to_numpy(x), axis))

def squeeze(x, axis=None):
    return Tensor(_np.squeeze(_to_numpy(x), axis=axis))

def stack(inputs, axis=0):
    return Tensor(_np.stack([_to_numpy(item) for item in inputs], axis=axis))

def concat(inputs, axis=0):
    return Tensor(_np.concatenate([_to_numpy(item) for item in inputs], axis=axis))

for _name, _fn in [
    ("zeros", zeros),
    ("ones", ones),
    ("arange", arange),
    ("matmul", matmul),
    ("reduce_sum", reduce_sum),
    ("reduce_mean", reduce_mean),
    ("reshape", reshape),
    ("transpose", transpose),
    ("expand_dims", expand_dims),
    ("squeeze", squeeze),
    ("stack", stack),
    ("concat", concat),
]:
    setattr(_ops_mod, _name, _fn)
    setattr(_ops_functional_mod, _name, _fn)

_dataset_mod = _ensure_submodule(_ms, "mindspore.dataset")
_dataset_transforms_mod = _ensure_submodule(_dataset_mod, "mindspore.dataset.transforms")
_dataset_vision_mod = _ensure_submodule(_dataset_mod, "mindspore.dataset.vision")
_train_mod = _ensure_submodule(_ms, "mindspore.train")
_train_callback_mod = _ensure_submodule(_train_mod, "mindspore.train.callback")

class _UnsupportedDataset:
    def __init__(self, *args, **kwargs):
        pass

    def batch(self, *args, **kwargs):
        raise NotImplementedError("前端沙箱不支持 MindSpore dataset.batch()；请改用后端沙箱或本地 Python 环境。")

    def shuffle(self, *args, **kwargs):
        raise NotImplementedError("前端沙箱不支持 MindSpore dataset.shuffle()；请改用后端沙箱或本地 Python 环境。")

    def map(self, *args, **kwargs):
        raise NotImplementedError("前端沙箱不支持 MindSpore dataset.map()；请改用后端沙箱或本地 Python 环境。")

_dataset_mod.GeneratorDataset = _UnsupportedDataset
_dataset_mod.NumpySlicesDataset = _UnsupportedDataset

class _TypeCast:
    def __init__(self, dtype):
        self.dtype = dtype

    def __call__(self, value):
        return value

_dataset_transforms_mod.TypeCast = _TypeCast

class _IdentityVision:
    def __init__(self, *args, **kwargs):
        pass

    def __call__(self, value):
        return value

_dataset_vision_mod.Rescale = _IdentityVision
_dataset_vision_mod.HWC2CHW = _IdentityVision

class Model:
    def __init__(self, *args, **kwargs):
        pass

    def train(self, *args, **kwargs):
        raise NotImplementedError("前端沙箱不支持 MindSpore Model.train()；请改用后端沙箱或本地 MindSpore 环境运行。")

    def eval(self, *args, **kwargs):
        raise NotImplementedError("前端沙箱不支持 MindSpore Model.eval()；请改用后端沙箱或本地 MindSpore 环境运行。")

    def predict(self, *args, **kwargs):
        raise NotImplementedError("前端沙箱不支持 MindSpore Model.predict()；请改用后端沙箱或本地 MindSpore 环境运行。")

class LossMonitor:
    def __init__(self, *args, **kwargs):
        pass

_train_mod.Model = Model
_train_mod.LossMonitor = LossMonitor
_train_callback_mod.LossMonitor = LossMonitor

_ms.Tensor = Tensor
_ms.Parameter = Parameter
_ms.nn = _nn_mod
_ms.ops = _ops_mod
_ms.dataset = _dataset_mod
_ms.train = _train_mod
`

function buildModuleResetScript(moduleName: string): string {
  return `
import sys as _sys
for _name in [name for name in list(_sys.modules) if name == "${moduleName}" or name.startswith("${moduleName}.")]:
    del _sys.modules[_name]
`
}

export function analyzePythonRuntimeRequirements(code: string): PythonRuntimeRequirements {
  const needsMindspore = /\bmindspore\b/i.test(code)
  const needsTorch = /\btorch\b/i.test(code)
  const needsDatasets = /\bsandbox_datasets\b/.test(code)

  const preloadPackages = new Set<string>()
  if (needsMindspore || needsTorch || needsDatasets) {
    preloadPackages.add('numpy')
  }

  return {
    needsMindspore,
    needsTorch,
    needsDatasets,
    preloadPackages: Array.from(preloadPackages),
  }
}

export async function prepareDatasetEnvironment(py: PythonRuntimeAdapter): Promise<void> {
  await py.loadPackage('numpy')
  py.runPython(SANDBOX_DATASETS_SCRIPT)
}

export async function prepareMindsporeLiteEnvironment(py: PythonRuntimeAdapter): Promise<void> {
  await py.loadPackage('numpy')
  await py.loadPackage('micropip')
  const micropip = py.pyimport('micropip') as MicropipLike
  micropip.add_mock_package('mindspore', '2.2.14')
  py.runPython(buildModuleResetScript('mindspore'))
  py.runPython(MINDSPORE_LITE_SCRIPT)
}
