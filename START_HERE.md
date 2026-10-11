# 🚀 Как запустить и проверить с визуализацией

## Вариант 1: Docker (проще)

```bash
# 1. Клонируй
git clone https://github.com/1tuz/fly-assistant.git
cd fly-assistant

# 2. Создай mock данные
./create_mock_data.sh

# 3. Запусти
docker-compose build  # Первый раз ~10 минут
docker-compose up

# 4. Открой браузер
http://localhost:8766
```

**Что увидишь:**
- 3D муха с крыльями и красными глазами
- Синяя полка (слева) и оранжевая (справа)
- Жёлтый объект на целевой полке
- Метрики: target shelf, brain activity, motor rates

**Mock данные монтируются:**
`./mock_data` → `/data` в контейнере

Файлы в `mock_data/documents/reports/` → муха будет их переносить в `mock_data/archive/`

---

## Вариант 2: Локально на macOS

```bash
# 1. Setup (если не завершился)
tail -f /tmp/flybrain_setup2.log  # Следи за прогрессом

# Когда увидишь "✅ Setup complete!"

# 2. Smoke test
source .venv/bin/activate
./tests/smoke_test.py

# 3. Mock данные
./create_mock_data.sh

# 4. Визуализация
./run.sh

# 5. Открой
http://127.0.0.1:8766

# 6. Обучение (быстрое)
./train.py --generations 10 --population 20
# ~2-3 минуты

# 7. Результаты
ls runs/training/
# best_policy.npz
# training_log.json
```

---

## Что проверить

### 1. API работает
```bash
curl http://localhost:8766/api/ping
# {"status":"ok"}
```

### 2. Состояние симуляции
```bash
curl http://localhost:8766/api/state | jq .world.fly
# {"position": [0, 0, 0], "yaw": 0}
```

### 3. Тесты захвата
```bash
python tests/test_grasping.py
# 5 tests passed
```

---

## Как муха работает

### Текущая задача (реализовано)
```
1. Муха стартует в центре (0, 0, 0)
2. Объект на левой или правой полке
3. Визуальный стимул (LC4 neurons) → target shelf
4. Муха летит к объекту
5. Захватывает (DNg12_e > 16 Hz)
6. Несёт к target shelf
7. Отпускает → +1.0 reward
```

### Будущее (нужно доделать)
```python
# Задача: перенести q1_report.txt из documents/reports в archive/2024

task = FileTransferTask(
    source="mock_data/documents/reports",
    target="mock_data/archive/2024",
    file="q1_report.txt"
)

# Муха реально переместит файл (os.rename)
```

---

## Mock данные

### Создай свои файлы
```bash
mkdir -p mock_data/my_folder
echo "Test content" > mock_data/my_folder/file.txt

# Docker автоматически смонтирует
docker-compose restart
```

### Структура
```
mock_data/
├── documents/
│   ├── reports/        ← муха берёт отсюда
│   │   ├── q1_report.txt
│   │   ├── q2_report.txt
│   │   └── q3_report.txt
│   └── invoices/
│       └── invoice_001.txt
└── archive/
    ├── 2024/           ← муха переносит сюда
    │   └── old_file.txt
    └── 2025/
```

---

## Обучение с визуализацией

**Сейчас:** статичная сцена  
**Скоро:** live-стриминг каждой попытки

```bash
# Terminal 1
./run.sh

# Terminal 2  
./train.py --generations 50 --viewer
# Браузер показывает каждую попытку в реальном времени
```

---

## Ожидаемые результаты

### Random policy (baseline)
- Success: ~0%
- Grasp: ~5%
- Delivery: ~0%

### После 50 generations ES
- Success: 10-30%
- Grasp: 30-50%
- Delivery: 5-15%

### С MLP policy (future)
- Success: 50-70%
- Grasp: 70-90%
- Delivery: 40-60%

---

## Полная документация

- **DOCKER_GUIDE.md** — детальная Docker инструкция
- **FINAL_REPORT.md** — что реализовано
- **FEATURE_FILE_SYSTEM.md** — файловая система + захват
- **README.md** — общая информация
- **QUICKSTART.md** — быстрые команды

---

## Текущий статус

✅ **Запушено на GitHub**: https://github.com/1tuz/fly-assistant  
✅ **Docker готов**: `docker-compose up`  
✅ **Код работает**: 1,634 LOC Python, 640 LOC JS  
✅ **Тесты есть**: 403 LOC tests  
🔄 **Setup на macOS**: завершается (~59% загрузки)  

**Готово к:** клонированию, запуску, разработке, расширению.

🪰✨
