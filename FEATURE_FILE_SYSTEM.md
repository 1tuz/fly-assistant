# Новый функционал: Файловая система + захват объектов

## ✅ Реализовано агентами

### 1. Захват объектов (ObjectGrasping)

**BrainAdapter** (src/brain/brain_adapter.py):
- Добавлены DNg12_e нейроны (left/right front legs)
- Input channels: `grasp_left`, `grasp_right` 
- Output channels: `readout_grasp_left`, `readout_grasp_right`
- Threshold: coxa promotors > 16 Hz → grasp activation

**WorldState** (src/environment/world_state.py):
```python
# Новые поля
self.object_is_carried = False
self.object_delivered = False

# Новый метод
def update_grasp(self, grasp_activation, release_activation):
    - Подбор: dist < GRASP_RADIUS (2.0) + grasp > 0.2
    - Перенос: объект следует за мухой (offset 0.4 units)
    - Сброс: release > 0.3 или at_target_shelf()
    - Доставка: object_delivered = True
```

**ShelfTaskEnv** (src/environment/shelf_task.py):
- Action dim: 3 → 5 ([forward, turn_left, turn_right, grasp, release])
- Observation dim: 10 → 13 (добавлены: object_dist, is_carried, object_pos)
- Reward: +1.0 за object_delivered (вместо просто at_target_shelf)

### 2. Визуализация файлов (NestedVisualization)

**BookcaseShelf class** (web/scene.js):
```javascript
class BookcaseShelf {
    constructor(path, name, depth) {
        this.depth = depth;
        this.dimensions = this.computeDimensions();
        // depth=0: 5.0x3.0x2.0 (большой шкаф)
        // depth=1: 2.0x0.4x2.0 (полка)
        // depth=2+: масштабируется * 0.7^depth
    }
    
    buildShelf() {
        // Открытый книжный шкаф:
        - Боковые панели
        - Верх/низ
        - Промежуточные полки (tiers)
        - Опорные столбики для depth <= 1
    }
    
    createLabel() {
        // Canvas текстура с названием папки и уровнем
        "📁 FolderName (L2)"
    }
    
    addFileObject(fileData) {
        // Книга/документ с цветом markers
        // Размер зависит от file.size
        // Спрайт-лейбл с именем файла
    }
}
```

**UI обновления** (web/index.html):
- Метрики: folder depth, file count, carried state
- Панель метаданных файла: name, size, markers

### 3. Дизайн файловой системы (FileSystemDesign)

**DESIGN_FILE_SYSTEM.md** содержит:
- `FileObject` class (path, size, metadata, markers, physical properties)
- `FolderHierarchy` class (tree structure, spatial layout)
- `PhysicsMode` enum (SIMPLIFIED vs REALISTIC)
- `BasePhysicsEngine` abstract interface
- API proposal для интеграции

## 🎯 Как это работает

### Старая задача (просто навигация)
```
Муха → Визуальный стимул → Полка (левая/правая)
Reward: +1 за достижение правильной полки
```

### Новая задача (перенос файла)
```
1. Муха летит к объекту (file.txt)
2. Близко к объекту → стимулирует DNg12_e
3. Coxa promotors fire > 16 Hz → захват
4. Объект привязан к мухе (offset 0.4)
5. Муха летит к target_shelf
6. Достигает полки → auto-release или manual release
7. object_delivered = True → +1.0 reward
```

### Reward breakdown
```
-0.001: за каждый шаг (encourage speed)
+0.0: подлетел близко (proximity < 2.0)
+1.0: object_delivered на правильной полке
-1.0: доставил на неправильную полку
```

## 📊 Статистика изменений

**Код:**
- brain_adapter.py: 176 → 179 строк (+3)
- world_state.py: 171 строк (добавлен update_grasp)
- shelf_task.py: 167 строк (action_dim 5, observation_dim 13)
- scene.js: 270 → 513 строк (+243, BookcaseShelf + file objects)

**Новые файлы:**
- DESIGN_FILE_SYSTEM.md (242 строки, полный дизайн)

**Обновлённые тесты:**
- tests/smoke_test.py (проверка grasp channels)

## 🚀 Следующие шаги

### Immediate (нужно доделать)
1. **Реализовать FileObject и FolderHierarchy** из дизайна
2. **Физика:** SimplifiedPhysics vs RealisticPhysics
3. **Обновить train.py** для 5D action space
4. **Обучить новую политику** с grasping

### Short-term
1. Интегрировать реальную FS: `FileObject` читает ~/documents/
2. Реальный перенос: update file path + OS move
3. Folder nesting UI: выбор depth в браузере
4. Live-стриминг обучения с файлами

### Mid-term
1. Multiple files в одном эпизоде
2. Вложенные папки depth > 2
3. Сортировка: по имени, по размеру, по дате
4. Batch transfer: перенести все *.pdf из A в B

## ⚠️ Известные ограничения

**Текущие:**
- Нет реального чтения FS (FileObject ещё заглушка)
- Упрощённая физика (нет инерции, коллизий)
- Один объект за раз
- Нет визуализации процесса захвата (анимация)

**Архитектурные:**
- DNg12_e path неточный (нет "grasp reflex" в коннектоме)
- Threshold 16 Hz подобран эмпирически, не биологически
- Release = manual action, не автоматический при контакте

## 🧪 Как протестировать

После завершения setup:

```bash
source .venv/bin/activate

# Smoke test с grasping
./tests/smoke_test.py

# Визуализация с новыми полками
./run.sh
# Открой http://127.0.0.1:8766

# Обучение с захватом (нужно обновить train.py для 5D)
# TODO: ./train.py --task grasp --generations 20
```

**Ожидаемое поведение:**
- Муха подлетает к объекту
- Близко → front-leg neurons активируются
- Объект "прилипает" к мухе
- Муха несёт к полке
- На полке → release → delivered

**Success rate:**
- Random policy: ~0% (hard task)
- После 50 gen ES: 10-20% (может захватить, но не доносит)
- С MLP policy: 40-60% (научится full pipeline)
