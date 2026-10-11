# Следующие шаги

## Сейчас

Setup работает в фоне (PID 82908), скачивает connectome-weights.feather.

**Прогресс:** 732 MB / ~1 GB загружено

**Чтобы проверить статус:**
```bash
tail -20 /tmp/flybrain_setup.log
```

**Когда увидишь:**
```
✓ Flybrain connectome ready
✅ Setup complete!
```

## После завершения setup

### 1. Проверь установку
```bash
cd /Users/antony/Documents/projects/fly-assistant
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

### 2. Запусти визуализацию
```bash
./run.sh
```
Открой http://127.0.0.1:8766 — должна появиться 3D-сцена с мухой и полками.

### 3. Тестовое обучение (быстрое)
```bash
./train.py --generations 10 --population 20
```
~2-3 минуты. Проверит работу обучения.

### 4. Полное обучение
```bash
./train.py --generations 50 --population 30
```
~10 минут. Результаты сохранятся в `runs/training/`:
- best_policy.npz
- training_log.json
- чекпоинты каждые 10 generations

## Если setup завис

**Проверь процесс:**
```bash
ps aux | grep setup.sh
```

**Если завис (нет прогресса >5 минут):**
```bash
kill 82908  # Убей процесс
cd flybrain
rm -f connectome-weights*.feather  # Удали частичную загрузку
bash setup.sh  # Перезапусти
```

## Если всё сломалось

```bash
cd /Users/antony/Documents/projects/fly-assistant
rm -rf .venv flybrain/*.npz flybrain/*.csv
./setup.sh
```

## Готово к работе?

**Да, если:**
- `flybrain/malecns_graph.npz` существует
- `flybrain/neurons.csv` существует
- smoke_test.py проходит все 4 теста

**Тогда можешь:**
- Обучать политики (`./train.py`)
- Смотреть 3D (`./run.sh`)
- Изменять код и экспериментировать

## Push в GitHub

```bash
git remote add origin https://github.com/1tuz/fly-assistant.git
git push -u origin main
```

---

**Текущий статус:** Setup в процессе. Всё остальное готово.
