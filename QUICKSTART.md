# Быстрый старт

## После завершения setup.sh

1. **Проверка установки:**
```bash
source .venv/bin/activate
./tests/smoke_test.py
```

2. **Запуск 3D визуализации:**
```bash
./run.sh
# Открой http://127.0.0.1:8766
```

3. **Обучение (быстрый тест):**
```bash
source .venv/bin/activate
./train.py --generations 10 --population 20
# ~2-3 минуты на M1/M2
```

4. **Полное обучение:**
```bash
./train.py --generations 50 --population 30
# ~10 минут, результат в runs/training/
```

## Что ожидать

- **Setup**: Занимает 5-10 минут (скачивание 1.1 GB данных, конвертация графа)
- **Smoke test**: Загрузит коннектом (~10-15 сек), проверит модули
- **Обучение**: Каждое поколение ~10-20 сек, показывает mean/max reward и success rate
- **Визуализация**: Статичная сцена (муха, полки, объект). Live-обновления в следующей итерации.

## Если что-то сломалось

```bash
# Пересоздать окружение
rm -rf .venv
./setup.sh

# Переконвертировать граф
cd flybrain
rm malecns_graph.npz neurons.csv
source ../.venv/bin/activate
python convert.py
```
