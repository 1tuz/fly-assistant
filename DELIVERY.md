# fly-assistant — Итоговый отчёт

## ✅ Что реализовано

### Код (1005 строк Python)
- **src/brain/brain_adapter.py** (176 строк): обёртка над flybrain, стимуляция LC4/LAL018/ICL012m, чтение DNp09/DNa01/02
- **src/environment/** (280 строк): WorldState + ShelfTaskEnv с физикой и Gymnasium API
- **src/agent/** (117 строк): LinearPolicy + SimpleES эволюционная стратегия
- **src/server/** (98 строк): HTTP сервер + API `/api/state` для live-обновлений
- **train.py** (198 строк): обучение с логированием, сохранением политик и чекпоинтов
- **tests/smoke_test.py** (112 строк): проверка импортов, world state, policy, brain adapter

### Визуализация
- **web/scene.js** (270 строк): Three.js сцена с мухой, полками, объектом, камерой, освещением
- **web/index.html + style.css**: UI с метриками (target shelf, steps, brain activity, motor rates)

### Документация
- **README.md**: установка, запуск, проверка, требования
- **ARCHITECTURE.md**: дизайн, компоненты, технологии
- **LIMITATIONS.md**: текущие ограничения, roadmap (короткий/средний/долгий срок)
- **QUICKSTART.md**: быстрые команды после setup
- **STATUS.md**: текущий статус проекта

### Инфраструктура
- **setup.sh**: автоматическая установка (Python, venv, зависимости, flybrain data)
- **run.sh**: запуск HTTP сервера
- **flybrain submodule**: интеграция через git submodule
- **.gitignore, LICENSE, requirements.txt**

## 🔄 Текущий статус

**Setup запущен** (PID 82908):
- ✅ Python 3.14.8 найден
- ✅ Virtual environment создан
- ✅ Зависимости установлены (numpy, pyarrow)
- ✅ body-annotations.feather (14 MB) скачан
- ✅ body-neurotransmitters.feather (43 MB) скачан
- 🔄 connectome-weights.feather загружается (465 MB / ~1 GB)
- ⏳ Конвертация графа начнётся после завершения загрузки

**Ожидаемое время**: ещё ~5-10 минут до завершения setup.

## 📋 После завершения setup

### 1. Проверка
```bash
source .venv/bin/activate
./tests/smoke_test.py
```
Ожидаемый вывод:
```
✓ All imports successful
✓ World state OK
✓ Policy and ES OK
✓ Brain adapter OK (165,384 neurons loaded)
✅ All 4 tests passed!
```

### 2. Запуск визуализации
```bash
./run.sh
# Открой http://127.0.0.1:8766
```
Должна появиться 3D-сцена с мухой, синей (левой) и оранжевой (правой) полками, жёлтым объектом.

### 3. Быстрое обучение (тест)
```bash
./train.py --generations 10 --population 20
```
Займёт ~2-3 минуты. Проверяет, что обучение работает.

### 4. Полное обучение
```bash
./train.py --generations 50 --population 30
```
~10 минут. Результаты в `runs/training/`:
- `best_policy.npz` — лучшая политика
- `training_log.json` — история обучения
- `policy_genN.npz` — чекпоинты каждые 10 поколений

## 🎯 Архитектура

```
train.py
  ↓
ShelfTaskEnv (observation: 10D, action: 3D Hz)
  ↓
BrainAdapter (stimulate LC4/LAL018/ICL012m)
  ↓
flybrain engine (165,384 neurons, LIF model)
  ↓
motor output (DNp09, DNa01/02) → fly movement
```

**Задача**: Муха видит визуальный стимул (левая/правая полка) и должна долететь до правильной.
- Reward: +1 правильная, -1 ошибка, -0.001 за шаг
- Episode: до 200 шагов или достижения полки

## 🚀 Следующие шаги

### Немедленно (после setup):
1. Запустить smoke test — проверить работоспособность
2. Обучить первую политику — убедиться, что ES сходится
3. Открыть визуализацию — проверить 3D-сцену

### Ближайшие (дни):
1. Подключить live-стриминг: trainer → HTTP API → браузер
2. Визуализация активности нейронов (raster plot)
3. Улучшить политику (добавить hidden layer или рекуррентность)

### Среднесрочные (недели):
1. Реализовать object manipulation (front-leg neurons для захвата)
2. Новые задачи (лабиринты, множественные объекты)
3. Параллелизация ES через multiprocessing

## 📊 Метрики проекта

- **Commits**: 5 (initial, limitations, summary, status, quickstart)
- **Files**: 20 (13 .py, 3 .js/.html/.css, 4 .md, 3 .sh, LICENSE, requirements.txt)
- **LOC Python**: 1005 строк
- **LOC JS/HTML/CSS**: ~350 строк
- **Documentation**: ~1500 строк markdown
- **Dependencies**: 2 (numpy, pyarrow)
- **Data size**: ~1.1 GB (MaleCNS connectome)

## ✨ Ключевые особенности

1. **Реальная нейросимуляция**: не анимация, а спайковая модель 165k реальных нейронов
2. **Always through synapses**: readouts игнорируют стимулированные нейроны
3. **Минимальные зависимости**: только numpy + pyarrow, без PyTorch/TensorFlow
4. **Модульная архитектура**: легко добавить новые задачи, политики, визуализации
5. **Local-first**: всё работает локально, без облачных сервисов

## 📝 Ограничения MVP

- Упрощённая физика (нет tripod gait)
- Нет захвата объекта (только навигация)
- Live-визуализация обучения не подключена
- Простая линейная политика
- Последовательная оценка (нет параллелизации)

Детали в `LIMITATIONS.md`.

---

**Статус**: Прототип готов. Setup завершается. После завершения — smoke test, обучение, визуализация.

**Репозиторий**: https://github.com/1tuz/fly-assistant
