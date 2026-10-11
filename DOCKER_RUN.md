# 🐋 Docker: Команды для запуска

## Быстрый старт

```bash
# 1. Клонируй репо
git clone https://github.com/1tuz/fly-assistant.git
cd fly-assistant

# 2. Создай mock файлы
./create_mock_data.sh

# 3. Собери Docker образ (первый раз ~10-15 минут)
docker-compose build

# 4. Запусти сервер с визуализацией
docker-compose up

# 5. Открой браузер
open http://localhost:8766
# или просто http://localhost:8766
```

**Готово!** Увидишь 3D-муху, полки и объект.

---

## Все команды Docker

### Сервер + визуализация
```bash
# Запуск (foreground, видишь логи)
docker-compose up

# Запуск в фоне
docker-compose up -d

# Остановка
docker-compose down

# Перезапуск
docker-compose restart

# Логи
docker-compose logs -f
```

### Обучение
```bash
# Запусти обучение в отдельном контейнере
docker-compose --profile training up training

# Или через docker run
docker-compose run --rm training python train.py --generations 50 --population 30
```

### Проверка работы
```bash
# Проверь API
curl http://localhost:8766/api/ping
# Ответ: {"status":"ok"}

# Состояние симуляции
curl http://localhost:8766/api/state | jq

# Smoke tests внутри контейнера
docker-compose exec fly-assistant python tests/smoke_test.py

# Тесты захвата
docker-compose exec fly-assistant python tests/test_grasping.py
```

---

## Mock данные

### Создание
```bash
# Автоматически создаст структуру
./create_mock_data.sh
```

### Структура (монтируется в /data)
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

### Добавь свои файлы
```bash
# Создай файлы
mkdir -p mock_data/my_project
echo "Important data" > mock_data/my_project/data.txt

# Перезапусти (автоматом смонтируется)
docker-compose restart
```

### Проверь монтирование
```bash
# Посмотри файлы внутри контейнера
docker-compose exec fly-assistant ls -la /data/documents/reports/
```

---

## Результаты обучения

### Где хранятся
```bash
# На хосте
ls runs/training/
# best_policy.npz
# training_log.json
# policy_gen10.npz, policy_gen20.npz, ...

# Внутри контейнера
docker-compose exec fly-assistant ls -la /app/runs/training/
```

### Просмотр логов
```bash
# Training log
cat runs/training/training_log.json | jq

# Последние 10 поколений
cat runs/training/training_log.json | jq '.[-10:]'
```

---

## Порты и volumes

### Изменить порт
```yaml
# docker-compose.yml
services:
  fly-assistant:
    ports:
      - "8888:8766"  # localhost:8888 -> container:8766
```

```bash
# Применить
docker-compose down
docker-compose up
```

### Volumes (автоматически)
- `./mock_data` ↔ `/data` в контейнере (read-write)
- `./runs` ↔ `/app/runs` в контейнере (read-write)

---

## Rebuild образа

```bash
# Пересобрать с нуля (если изменился код)
docker-compose build --no-cache

# Пересобрать и запустить
docker-compose up --build
```

---

## Отладка

### Зайти в контейнер
```bash
# Bash в running контейнере
docker-compose exec fly-assistant bash

# Внутри контейнера
ls /app
ls /data
python --version
```

### Запустить команду
```bash
# Smoke test
docker-compose exec fly-assistant python tests/smoke_test.py

# Training (короткий)
docker-compose exec fly-assistant python train.py --generations 5 --population 10

# Проверка brain
docker-compose exec fly-assistant python -c "from src.brain import BrainAdapter; b = BrainAdapter(); print('OK')"
```

### Логи контейнера
```bash
# Все логи
docker-compose logs

# Только server
docker-compose logs fly-assistant

# Только training
docker-compose logs training

# Follow mode
docker-compose logs -f
```

---

## Остановка и очистка

```bash
# Остановить
docker-compose down

# Остановить + удалить volumes
docker-compose down -v

# Удалить образ
docker rmi fly-assistant_fly-assistant

# Полная очистка
docker-compose down -v
docker system prune -a
```

---

## Troubleshooting

### Port already in use
```bash
# Найди процесс на порту 8766
lsof -i :8766

# Убей или измени порт в docker-compose.yml
```

### Build failed
```bash
# Rebuild без cache
docker-compose build --no-cache

# Проверь логи
docker-compose logs fly-assistant
```

### Connectome не загрузился
```bash
# Зайди в контейнер
docker-compose exec fly-assistant bash

# Внутри контейнера
cd flybrain
ls -lh *.feather
bash setup.sh
```

### Mock data не видны
```bash
# Проверь монтирование
docker-compose exec fly-assistant ls -la /data

# Если пусто - создай
./create_mock_data.sh
docker-compose restart
```

---

## Production ready

### С restart policy
```yaml
# docker-compose.yml
services:
  fly-assistant:
    restart: always  # Автоматический перезапуск
```

### В фоне
```bash
docker-compose up -d
docker-compose logs -f  # Следи за логами
```

### Health check
```bash
# Каждые 5 секунд
while true; do 
  curl -s http://localhost:8766/api/ping | jq
  sleep 5
done
```

---

## Что проверить

### 1. Сервер работает
```bash
curl http://localhost:8766/api/ping
# {"status":"ok"}
```

### 2. API отдаёт состояние
```bash
curl http://localhost:8766/api/state | jq .world
```

### 3. Визуализация открывается
```bash
open http://localhost:8766
# или в браузере вручную
```

### 4. Mock данные на месте
```bash
docker-compose exec fly-assistant ls /data/documents/reports/
# q1_report.txt
# q2_report.txt
# q3_report.txt
```

### 5. Тесты проходят
```bash
docker-compose exec fly-assistant python tests/test_grasping.py
# OK (5 tests)
```

---

## Полный workflow

```bash
# 1. Клонировать
git clone https://github.com/1tuz/fly-assistant.git
cd fly-assistant

# 2. Mock данные
./create_mock_data.sh

# 3. Build
docker-compose build

# 4. Запуск
docker-compose up -d

# 5. Проверка
curl http://localhost:8766/api/ping

# 6. Визуализация
open http://localhost:8766

# 7. Обучение
docker-compose run --rm training python train.py --generations 10

# 8. Результаты
ls runs/training/

# 9. Остановка
docker-compose down
```

🪰✨ Готово к запуску!
