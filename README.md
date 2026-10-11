# fly-assistant 🪰

Цифровая дрозофила с реальной нейросимуляцией (165,384 нейрона) и 3D-визуализацией. Обучается переносить файлы между папками через reinforcement learning.

## 🚀 Быстрый старт (Docker)

```bash
git clone https://github.com/1tuz/fly-assistant.git
cd fly-assistant

./create_mock_data.sh      # Создать mock файлы
docker-compose build        # ~10 минут
docker-compose up           # Запустить

open http://localhost:8766  # Визуализация
```

**Готово!** Увидишь 3D-муху, полки и объект.

## 📖 Документация

- **[DOCKER_RUN.md](DOCKER_RUN.md)** — все команды Docker
- **[START_HERE.md](START_HERE.md)** — быстрый старт
- **[DOCKER_GUIDE.md](DOCKER_GUIDE.md)** — детальная инструкция
- **[FINAL_REPORT.md](FINAL_REPORT.md)** — что реализовано
- **[FEATURE_FILE_SYSTEM.md](FEATURE_FILE_SYSTEM.md)** — файловая система + захват

## ✨ Возможности

### Реализовано
- ✅ Реальная нейросимуляция (165k neurons MaleCNS v1.0)
- ✅ Захват объектов через DNg12_e нейроны
- ✅ Перенос объектов между полками
- ✅ 3D визуализация (Three.js)
- ✅ Обучение через эволюционную стратегию
- ✅ 5D action space: [forward, turn_left, turn_right, grasp, release]
- ✅ Mock данные монтируются в Docker

### В разработке
- ⏳ Real FS integration (чтение реальных файлов)
- ⏳ Actual file transfer (os.rename при delivery)
- ⏳ Live training visualization
- ⏳ Multiple files per episode

## 🎮 Как работает

```
1. Муха стартует в (0, 0, 0)
2. Визуальный стимул (LC4 neurons) → target shelf
3. Муха летит к объекту
4. Захватывает (DNg12_e > 16 Hz)
5. Несёт к целевой полке
6. Отпускает → +1.0 reward
```

### Mock данные (автоматом монтируются)

```
mock_data/
├── documents/reports/    ← муха берёт файлы отсюда
│   ├── q1_report.txt
│   └── q2_report.txt
└── archive/2024/         ← переносит сюда
```

## 📊 Команды

### Docker
```bash
docker-compose up              # Запустить визуализацию
docker-compose up -d           # В фоне
docker-compose logs -f         # Логи
docker-compose down            # Остановить

# Обучение
docker-compose run --rm training python train.py --generations 50

# Тесты
docker-compose exec fly-assistant python tests/test_grasping.py
```

### Локально (macOS)
```bash
./setup.sh                     # Установка (первый раз)
./run.sh                       # Визуализация
./train.py --generations 10    # Обучение

source .venv/bin/activate
./tests/smoke_test.py          # Тесты
python tests/test_grasping.py  # Тесты захвата
```

## 🔍 Проверка

```bash
# API работает
curl http://localhost:8766/api/ping

# Состояние
curl http://localhost:8766/api/state | jq

# Тесты
docker-compose exec fly-assistant python tests/test_grasping.py
```

## 📈 Метрики

После обучения:
- Success rate: 10-30%
- Grasp rate: 30-50%
- Delivery rate: 5-15%

## 🛠️ Технологии

- **Brain**: flybrain (165k neurons, LIF model, MaleCNS v1.0)
- **RL**: Evolution Strategy (ES), linear policy
- **3D**: Three.js
- **Backend**: Python 3.12, numpy, pyarrow
- **Deploy**: Docker + docker-compose

## 📝 Архитектура

```
train.py → ShelfTaskEnv → BrainAdapter → flybrain (real neurons)
                             ↓
                        HTTP Server ← web/scene.js (3D)
```

## 📦 Структура

```
fly-assistant/
├── src/
│   ├── brain/          # BrainAdapter (DNg12_e neurons)
│   ├── environment/    # ShelfTaskEnv, WorldState, FileObject
│   ├── agent/          # LinearPolicy, SimpleES
│   └── server/         # HTTP API
├── web/                # Three.js visualization
├── tests/              # Smoke + grasping tests
├── mock_data/          # Mock files (mounted in Docker)
├── train.py            # Training script
└── Dockerfile          # Docker setup
```

## 🎯 Roadmap

### Short-term
- Real FS integration
- Actual file transfer (os.rename)
- Live training visualization

### Mid-term
- Multiple files per episode
- Nested folders (depth > 2)
- Better policy (MLP, LSTM)

### Long-term
- Advanced RL (PPO, SAC)
- Curriculum learning
- Neural path analysis

## 📊 Stats

- **Commits**: 11
- **Python**: 1,634 LOC
- **JS/HTML**: 640 LOC
- **Docs**: 1,815 LOC
- **Tests**: 403 LOC

## 🤝 Credits

Based on [flybrain](https://github.com/jppaquet/flybrain) by jppaquet.
Connectome data: MaleCNS v1.0 by FlyEM (Janelia Research Campus).

## 📄 License

MIT (see LICENSE)

MaleCNS data distributed under CC-BY 4.0 (FlyEM/Janelia).

---

🪰✨ **Ready to fly!**
