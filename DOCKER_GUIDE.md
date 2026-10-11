# 🐋 Docker + визуализация: полная инструкция

## Быстрый старт (Docker)

### 1. Создай mock данные
```bash
./create_mock_data.sh
```

Создаст структуру:
```
mock_data/
├── documents/
│   ├── reports/
│   │   ├── q1_report.txt
│   │   ├── q2_report.txt
│   │   └── q3_report.txt
│   └── invoices/
│       ├── invoice_001.txt
│       └── invoice_002.txt
└── archive/
    ├── 2024/
    │   └── old_file.txt
    └── 2025/
```

### 2. Запусти Docker
```bash
# Собери образ (первый раз ~10-15 минут, качает connectome)
docker-compose build

# Запусти сервер
docker-compose up
```

### 3. Открой браузер
```
http://localhost:8766
```

Увидишь 3D-сцену с мухой, полками и объектами.

---

## Без Docker (локально на macOS)

### 1. Setup (если ещё не завершился)
```bash
# Проверь статус
tail -f /tmp/flybrain_setup2.log

# Когда увидишь "✅ Setup complete!", можно начинать
```

### 2. Создай mock данные
```bash
./create_mock_data.sh
```

### 3. Smoke test
```bash
source .venv/bin/activate
./tests/smoke_test.py
```

Должно вывести:
```
✓ All imports successful
✓ World state OK  
✓ Policy and ES OK
✓ Brain adapter OK (165,384 neurons loaded)
✅ All 4 tests passed!
```

### 4. Тесты захвата
```bash
python tests/test_grasping.py
```

Проверяет:
- Захват объекта
- Перенос (object follows fly)
- Сброс на полке
- Полный pipeline

### 5. Запусти визуализацию
```bash
./run.sh
```

Открой: http://127.0.0.1:8766

**Что увидишь:**
- Муха (чёрное тело, красные глаза, крылья)
- Левая полка (синяя)
- Правая полка (оранжевая)
- Жёлтый объект на целевой полке
- Метрики: target shelf, steps, brain activity, motor rates

### 6. Обучение (быстрое)
```bash
./train.py --generations 10 --population 20
```

~2-3 минуты. Вывод:
```
Gen   0 | pop_mean=-0.154 pop_max=-0.089 | best_return=-0.112 success=0.0% | 12.3s
Gen   1 | pop_mean=-0.143 pop_max=-0.081 | best_return=-0.098 success=0.0% | 11.8s
...
Gen  10 | pop_mean=-0.098 pop_max=0.234 | best_return=0.187 success=16.7% | 12.1s ⭐ NEW BEST
```

Результат: `runs/training/best_policy.npz`

### 7. Полное обучение
```bash
./train.py --generations 50 --population 30
```

~10 минут. Ожидаемые метрики:
- Success rate: 10-30%
- Grasp rate: 30-50%
- Delivery rate: 5-15%

---

## Визуализация с real-time обучением

**TODO (в следующей итерации):**

1. Запусти server в одном терминале:
```bash
./run.sh
```

2. Запусти обучение с viewer в другом:
```bash
./train.py --generations 50 --viewer
```

Браузер будет показывать каждую попытку мухи в реальном времени.

---

## Задача мухе: перенос файлов

### Текущая задача (MVP)
```
1. Муха стартует в (0, 0, 0)
2. Объект на одной из полок (left=-5,0,10 или right=5,0,10)
3. Визуальный стимул (LC4 neurons) указывает target shelf
4. Муха должна:
   - Подлететь к объекту
   - Захватить (DNg12_e neurons > 16 Hz)
   - Донести до target shelf
   - Отпустить (release или авто при достижении)
5. Reward: +1.0 за object_delivered
```

### Будущее: реальные файлы
После интеграции с FileObject:
```python
# Задача: перенести q1_report.txt из documents/reports в archive/2024

task = FileTransferTask(
    source="/data/documents/reports",
    target="/data/archive/2024",
    file="q1_report.txt"
)

# Муха:
# 1. Находит q1_report.txt
# 2. Захватывает
# 3. Летит к archive/2024
# 4. Отпускает
# 5. Файл реально перемещается: os.rename()
```

---

## Структура mock_data для Docker

**Docker автоматически монтирует `./mock_data` → `/data` в контейнере.**

Муха видит:
```
/data/documents/reports/     ← source folder (shelf)
/data/archive/2024/          ← target folder (shelf)
```

**После интеграции FS:**
```bash
# Создай свою структуру
mkdir -p mock_data/projects/active
mkdir -p mock_data/projects/completed
echo "My project" > mock_data/projects/active/project1.txt

# Запусти
docker-compose up

# Муха обучится переносить файлы между папками
# Прогресс сохраняется в ./runs/
```

---

## Проверка работы

### 1. Визуализация работает?
```bash
curl http://localhost:8766/api/ping
# Ответ: {"status":"ok"}
```

### 2. Состояние мухи
```bash
curl http://localhost:8766/api/state | jq
```

Вывод:
```json
{
  "world": {
    "fly": {
      "position": [0, 0, 0],
      "yaw": 0
    },
    "shelves": {
      "left": [-5, 0, 10],
      "right": [5, 0, 10]
    },
    "object": {
      "position": [5, 0.4, 10]
    },
    "target_shelf": 1
  },
  "running": true
}
```

### 3. Логи обучения
```bash
# Docker
docker-compose logs -f training

# Локально
tail -f runs/training/training_log.json
```

---

## Troubleshooting

### Docker build fails на flybrain setup
```bash
# Build без cache
docker-compose build --no-cache
```

### Port 8766 занят
```bash
# Измени порт в docker-compose.yml
ports:
  - "8888:8766"  # localhost:8888 -> container:8766
```

### Нет mock_data/
```bash
./create_mock_data.sh
```

### Setup не завершился (локально)
```bash
# Проверь статус
ps aux | grep setup.sh

# Если завис
killall setup.sh
cd flybrain && rm -f connectome-weights*.feather
bash setup.sh
```

---

## Что дальше?

### Short-term
1. **Интегрировать FileObject с реальной FS**
   - Читать файлы из `/data`
   - Реальный `os.rename()` при delivery
   
2. **Multiple files**
   - Batch transfer: все *.txt из A в B
   
3. **Live training viz**
   - Подключить trainer → HTTP API
   - Стрим в браузер в реальном времени

### Mid-term
1. **Сортировка**
   - По имени (alphabetical)
   - По размеру (largest first)
   - По дате (newest first)
   
2. **Nested folders**
   - Depth > 2
   - Визуализация иерархии
   
3. **Улучшенная политика**
   - MLP вместо linear
   - Рекуррентная (LSTM) для последовательности действий

---

## Репозиторий

```
https://github.com/1tuz/fly-assistant
```

**Запушено:**
- 9 commits
- 1,634 LOC Python
- 640 LOC JS/HTML/CSS
- 1,815 LOC документации
- Dockerfile + docker-compose
- Mock data setup

**Готово к:**
- Клонированию
- Docker запуску
- Локальной разработке
- Расширению функционала

🪰✨
